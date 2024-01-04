---
title: circumventing the JVM's bytecode verifier
description: using sun.misc.Unsafe to force -Xverify:none at runtime
featured: true
---

An adventure with Java bytecode, HotSpot VM internals, `sun.misc.Unsafe`, and the power of Java.

*Please* don't do this in production (or do, but as a prank).

<section>

## Introduction & Motivation

Hi. I'm Charlotte, and for the last three years, I have been the author of [a Java bytecode obfuscator](https://paramorphism.dev). Because of this, I've been messing with the JVM almost daily for a long time, and have built up a **comprehensive** knowledge base of next-to-useless information about an antiquated bytecode interpreter and its accompanying state-of-the-art JIT system, all packaged up to create a platform that powers three billion[^1] devices.

Today, we're going to be disabling the bytecode verifier using only pure Java.

[^1]: <span class="language-math">n = 3,000,000,000; \frac{dn}{dt} = 0</span>

## Wait, what is this "bytecode verifier", anyway?

Okay, so, when you create a Java program, you compile it with `javac`, it gets converted into a `.class` file that consists of Java bytecode, and (maybe) packed into a JAR file. (You can think of a JAR file as like a ZIP file, except it's exactly the same file format.)

When you *run* this Java program, the bytecode is parsed from the input file (be it a standalone `.class` file or a JAR file) and goes through several stages, including **class verification**: The class is checked to see if its contents conform to the JVM specification, and is rejected if it's too weird.

### So, what could we do?

There's all sorts of fun things you can do in a JVM program if you have the bytecode verifier switched off. You can try this at home, yourself, by passing the `-noverify` flag to the JVM via its startup arguments. (Getting a hold of some non-verifying bytecode is left as an exercise to the reader.)

An example of bytecode verification is checking whether jump instructions are at valid locations:

Here is a simple case where we jump to a label with the `goto` instruction:

<pre><code class="hljs-manual lang-javabytecode"><span class="hljs-function"><span class="hljs-keyword">public</span> <span class="hljs-keyword">int</span> <span class="hljs-name">myWeirdMethod</span>():</span>
  <span class="hljs-keyword">goto</span> my_label
  <span class="hljs-keyword">sipush</span> <span class="hljs-number">0x06ac</span>
  <span class="hljs-keyword">ireturn</span>

  my_label:
  <span class="hljs-keyword">sipush</span> <span class="hljs-number">0x1234</span>
  <span class="hljs-keyword">ireturn</span>
</code></pre>

It decompiles to something like this:

```java
public int myMethod() {
  if (false) {
    return 0x06ac;
  }

  return 0x1234;
}
```

But if we peruse the [Java bytecode instruction listings](https://en.wikipedia.org/wiki/Java_bytecode_instruction_listings) on Wikipedia, we notice that `goto` doesn't take a reference to any label - it takes a direct offset.

Therefore, we can manipulate our `goto` instruction to jump into the middle of our immediate `short` constant that usually would act as the operand to `sipush`:

<pre><code class="hljs-manual language-javabytecode"><span class="hljs-function"><span class="hljs-keyword">public</span> <span class="hljs-keyword">int</span> myWeirdMethod():</span>
  <span class="hljs-keyword">goto</span> &lt;four bytes forward&gt;
  <span class="hljs-keyword">sipush</span> <span class="hljs-number">0x06ac</span>
  <span class="hljs-keyword">ireturn</span>

  <span class="hljs-keyword">sipush</span> <span class="hljs-number">0x1234</span>
  <span class="hljs-keyword">ireturn</span>
</code></pre>

Which wouldn't really decompile:

```java
public int myWeirdMethod() {
  goto "??"; // Whoa, that's the middle of an instruction!
  return 0x06ac;
  return 0x1234;
}
```

But in reality, the method is equivalent to:

```java
public int myWeirdMethod() {
  return 3;
}
```

because `0x06ac` is actually two bytes comprising two Java bytecode instructions: `0x06` being `iconst_3`, and `0xac` being `ireturn`.

Because bytecode analysis tools (and humans!) aren't prepared for non-verifying bytecode, we can use it to our advantage when concealing procedures from commonly-used tools. (For example, as a technical layer for intellectual property protection)

</section>
<section>

## The Goal

Now that we've seen what's possible without the bytecode verifier, and thought about how non-verifiable behaviour is desirable under certain use cases, we can set out to disable the bytecode verifier without mandating the use of the JVM launch option. Plus, we can do this at any time, not just at start-up.

First, we will lay out some ground rules:

1. The program should work without a hitch on most[^2] JVMs.
2. To achieve this: The developer writes in JVM languages, and nothing but.
  - For the sake of this exercise, we'll consider dropping into user-written native code cheating. We don't want to rely on [JNI](https://en.wikipedia.org/wiki/Java_Native_Interface), [JVM TI](https://en.wikipedia.org/wiki/Java_Virtual_Machine_Tools_Interface), or anything but what the JVM provides us.
  - For these examples, I'll be writing Java and Kotlin.

[^2]: We're actually only targeting HotSpot-based Java Virtual Machines right now, but it's a fair compromise: I've yet to discover anyone who actually uses an OpenJ9 VM without also having a HotSpot-based one installed. Both the Oracle VMs and OpenJDK are compiled with HotSpot by default.

</section>
<section>

## Getting Dangerous: `sun.misc.Unsafe`

We've seen the *why*, we've seen the *what*; it's time for: the *how*.

`sun.misc.Unsafe` is an internal, deprecated API that you shouldn't ever use, *but*... It's super useful.

The `Unsafe` API is mainly used by libraries like [kryo](https://github.com/EsotericSoftware/kryo) for high-performance serialization. This takes advantage of one facet of `Unsafe`: Creating objects *without* calling any of their constructors.

However, `Unsafe` has many more usages. Today, we're going to use **Direct Memory Access**.

`Unsafe` has [a few methods](https://github.com/AdoptOpenJDK/openjdk-jdk8u/blob/master/jdk/src/share/classes/sun/misc/Unsafe.java#L411) for direct memory access, but the gist is:

```java
/** Read a single byte from an arbitrary address in memory */
public native byte getByte(long address);

/** Write a single byte to an arbitrary address in memory */
public native void putByte(long address, byte x);
```

### Getting a hold of an `Unsafe`

If you notice, these methods in `Unsafe` are virtual, not `static`, so we need to get ourselves an `Unsafe` object.

`sun.misc.Unsafe` *does* actually follow the singleton design pattern, but its getter is gated by a security check:

```java
@CallerSensitive
public static Unsafe getUnsafe() {
  Class<?> caller = Reflection.getCallerClass();
  ClassLoader loader = caller.getClassLoader();
  if (!VM.isSystemDomainLoader(loader))
    throw new SecurityException("Unsafe");
  return theUnsafe;
}
```

To get around this, we can simply reflection into the `theUnsafe` field, making sure we do a `field.setAccessible(true)` to bypass the access restrictions:

```kotlin
val unsafe by lazy {
  Unsafe::class.java
    .getDeclaredField("theUnsafe")
    .also { it.isAccessible = true }
    .get(null) as Unsafe
}
```

## JVM Internals: Where should we write?

If we want to emulate the behaviour of `-noverify`, the best place to start is looking at how the `java` command handles this command-line argument.

[The `-noverify` flag is handled in `java.c`](https://github.com/AdoptOpenJDK/openjdk-jdk8u/blob/master/jdk/src/share/bin/java.c#L1153) - And it appears to just be an alias for another option:

```cpp
  // ...
} else if (JLI_StrCmp(arg, "-noverify") == 0) {
  AddOption("-Xverify:none", NULL);
} else {
  // ...
}
```

So, we'll see what `-Xverify:none` does. `-X` flags are handled by [arguments.cpp](https://github.com/AdoptOpenJDK/openjdk-jdk8u/blob/master/hotspot/src/share/vm/runtime/arguments.cpp#L3178), and we see that depending on its value, a macro called `FLAG_SET_CMDLINE` is invoked with `BytecodeVerificationLocal` and `BytecodeVerificationRemote` as the flags:

```cpp
  // ...
} else if (match_option(option, "-Xverify", &tail)) {
  if (strcmp(tail, ":all") == 0 || strcmp(tail, "") == 0) {
    FLAG_SET_CMDLINE(bool, BytecodeVerificationLocal, true);
    FLAG_SET_CMDLINE(bool, BytecodeVerificationRemote, true);
  } else if (strcmp(tail, ":remote") == 0) {
    FLAG_SET_CMDLINE(bool, BytecodeVerificationLocal, false);
    FLAG_SET_CMDLINE(bool, BytecodeVerificationRemote, true);
  } else if (strcmp(tail, ":none") == 0) {
    FLAG_SET_CMDLINE(bool, BytecodeVerificationLocal, false);
    FLAG_SET_CMDLINE(bool, BytecodeVerificationRemote, false);
  }
} else {
  // ...
}
```

... which we can follow to [the `should_verify_for` method in `Verifier`](https://github.com/AdoptOpenJDK/openjdk-jdk8u/blob/2544d2a351eca1a3d62276f969dd2d95e4a4d2b6/hotspot/src/share/vm/classfile/verifier.cpp#L99):

```cpp
bool Verifier::should_verify_for(oop class_loader, bool should_verify_class) {
  return (class_loader == NULL || !should_verify_class) ?
    BytecodeVerificationLocal : BytecodeVerificationRemote;
}
```

Perfect. We've found what we wanted. Our targets are the `BytecodeVerificationLocal` and `BytecodeVerificationRemote` flags.

## JVM Internals: How do we get there?

Okay. We know where we want to write, but it's not like we can call `unsafe.putByte(BytecodeVerificationLocal, 0)` and have it Just Work™. We have to somehow find the memory addresses of these flags.

Luckily, somebody, somewhere, at some time in the past, ***has*** wanted to profile the JVM, meaning that, theoretically, enough information must be exposed to let a profiler access performance statistics for them to be displayed. I'd like to thank the high-frequency trading industry for making this adventure possible.

### The Serviceability Agent

A few months ago, while looking into different Java profilers, I discovered the [Serviceability Agent](http://openjdk.java.net/groups/hotspot/docs/Serviceability.html), otherwise known as: "what's this `sa-jdi.jar` file doing in my Java install?"

Anyway, in order for the agent to function, the JVM exposes a few global fields to allow applications to inspect its current state. On an x86_64 Linux install of OpenJDK 8, they look like this:

<pre><code class="hljs lang-bash">$ <span class="hljs-keyword">cd</span> /usr/lib/jvm/default/jre/lib/amd64/server/
server/ $ <span class="hljs-keyword">nm</span> -D libjvm.so | <span class="hljs-keyword">grep</span> gHotSpot
<span class="hljs-number">0000000000d222e0</span> B <span class="hljs-string">gHotSpotVMIntConstantEntryArrayStride</span>
<span class="hljs-number">0000000000d222f0</span> B <span class="hljs-string">gHotSpotVMIntConstantEntryNameOffset</span>
<span class="hljs-number">0000000000d222e8</span> B <span class="hljs-string">gHotSpotVMIntConstantEntryValueOffset</span>
<span class="hljs-number">0000000000ce4568</span> D <span class="hljs-string">gHotSpotVMIntConstants</span>
<span class="hljs-number">0000000000d222c8</span> B <span class="hljs-string">gHotSpotVMLongConstantEntryArrayStride</span>
<span class="hljs-number">0000000000d222d8</span> B <span class="hljs-string">gHotSpotVMLongConstantEntryNameOffset</span>
<span class="hljs-number">0000000000d222d0</span> B <span class="hljs-string">gHotSpotVMLongConstantEntryValueOffset</span>
<span class="hljs-number">0000000000ce4560</span> D <span class="hljs-string">gHotSpotVMLongConstants</span>
<span class="hljs-number">0000000000d22338</span> B <span class="hljs-string">gHotSpotVMStructEntryAddressOffset</span>
<span class="hljs-number">0000000000d22330</span> B <span class="hljs-string">gHotSpotVMStructEntryArrayStride</span>
<span class="hljs-number">0000000000d22358</span> B <span class="hljs-string">gHotSpotVMStructEntryFieldNameOffset</span>
<span class="hljs-number">0000000000d22348</span> B <span class="hljs-string">gHotSpotVMStructEntryIsStaticOffset</span>
<span class="hljs-number">0000000000d22340</span> B <span class="hljs-string">gHotSpotVMStructEntryOffsetOffset</span>
<span class="hljs-number">0000000000d22360</span> B <span class="hljs-string">gHotSpotVMStructEntryTypeNameOffset</span>
<span class="hljs-number">0000000000d22350</span> B <span class="hljs-string">gHotSpotVMStructEntryTypeStringOffset</span>
<span class="hljs-number">0000000000ce4578</span> D <span class="hljs-string">gHotSpotVMStructs</span>
<span class="hljs-number">0000000000d222f8</span> B <span class="hljs-string">gHotSpotVMTypeEntryArrayStride</span>
<span class="hljs-number">0000000000d22310</span> B <span class="hljs-string">gHotSpotVMTypeEntryIsIntegerTypeOffset</span>
<span class="hljs-number">0000000000d22318</span> B <span class="hljs-string">gHotSpotVMTypeEntryIsOopTypeOffset</span>
<span class="hljs-number">0000000000d22308</span> B <span class="hljs-string">gHotSpotVMTypeEntryIsUnsignedOffset</span>
<span class="hljs-number">0000000000d22300</span> B <span class="hljs-string">gHotSpotVMTypeEntrySizeOffset</span>
<span class="hljs-number">0000000000d22320</span> B <span class="hljs-string">gHotSpotVMTypeEntrySuperclassNameOffset</span>
<span class="hljs-number">0000000000d22328</span> B <span class="hljs-string">gHotSpotVMTypeEntryTypeNameOffset</span>
<span class="hljs-number">0000000000ce4570</span> D <span class="hljs-string">gHotSpotVMTypes</span>
</code></pre>

Now all that's left to do is to find their locations within our own Java process.

### Finding Natives: `ClassLoader.findNative(...)`

In the Java standard library, a package-private method `ClassLoader.findNative` is used to locate the native handles of Java `native` methods. However, since the implementation is so simple, we can use it to look up *any* native symbol in the Java process, including these `gHotSpotXYZ` values.

```kotlin
private val findNativeMethod by lazy {
  ClassLoader::class.java
    .getDeclaredMethod("findNative", ClassLoader::class.java, String::class.java)
    .also { it.isAccessible = true }
}

fun findNative(name: String, classLoader: ClassLoader? = null): Long {
  return findNativeMethod.invoke(null, classLoader, name) as Long
}
```

Let's test what we have so far:

```kotlin
fun main() {
  val gHotSpotVMStructs = findNative("gHotSpotVMStructs")
  println("0x" + findNative("gHotSpotVMStructs").toString(16) +
    ", value 0x" + unsafe.getLong(gHotSpotVMStructs).toString(16))
}
```

When run a few times, outputs:

```
0x7f448bd98578, value 0x7f448bd9ffc0
[...]
0x7f21049b9578, value 0x7f21049c0fc0
[...]
0x7fba21bcc578, value 0x7fba21bd3fc0
```

Notice of how the last three nibbles of both values are always the same (the variation in base addresses is due to ASLR), and the last three nibbles of gHotSpotVMStructs' location also matches the location that `nm` reported &ndash; `00ce4578`.

</section>
<section>

## Reading The Structs

Since we want to eventually write to [a `Flag` struct](https://github.com/AdoptOpenJDK/openjdk-jdk8u/blob/master/hotspot/src/share/vm/runtime/globals.hpp#L211)'s value[^3], as well as read its name, we'll want to walk the `gHotSpotVMStructs` array.

[^3]: `Flag` was actually refactored and [renamed to `JVMFlag`](https://github.com/AdoptOpenJDK/openjdk-jdk13u/commit/170f0455bb3bba06f4f42007aae098b445f2e8c8) in Java 11, but we can just swap out the name for later versions.


This is actually pretty simple, as we already have all the gadgets in place to do so.

Since we're going to have to read the names of things, we'll create a little method so that `Unsafe` can read String values:

```kotlin
fun Unsafe.getString(addr: Long): String? {
  if (addr == 0L) return null

  return buildString {
    var offset = 0

    while (true) {
      val ch = getByte(addr + offset++).toChar()
      if (ch == '\u0000') break
      append(ch)
    }
  }
}
```

Then, we can create a small containing class for our structs:

```kotlin
data class JVMStruct(val name: String) {
  val fields = mutableMapOf<String, Field>()
  operator fun get(f: String) = fields.getValue(f)
  operator fun set(f: String, value: Field) { fields[f] = value }

  data class Field(
    val name: String, val type: String?,
    val offset: Long, val static: Boolean
  )
}
```

And finally, walk through the structs array and populate a map of JVMStruct objects:

```kotlin
fun getStructs(): Map<String, JVMStruct> {
  val structs = mutableMapOf<String, JVMStruct>()

  fun symbol(name: String) = unsafe.getLong(findNative(name))
  fun offsetSymbol(name: String) = symbol("gHotSpotVMStructEntry${name}Offset")
  fun derefReadString(addr: Long) = unsafe.getString(unsafe.getLong(addr))

  var currentEntry = symbol("gHotSpotVMStructs")
  val arrayStride = symbol("gHotSpotVMStructEntryArrayStride")

  while (true) {
    val typeName = derefReadString(currentEntry + offsetSymbol("TypeName"))
    val fieldName = derefReadString(currentEntry + offsetSymbol("FieldName"))
    if (typeName == null || fieldName == null)
      break

    val typeString = derefReadString(currentEntry + offsetSymbol("TypeString"))
    val static = unsafe.getInt(currentEntry + offsetSymbol("IsStatic")) != 0

    val offsetOffset = if (static) offsetSymbol("Address") else offsetSymbol("Offset")
    val offset = unsafe.getLong(currentEntry + offsetOffset)

    val struct = structs.getOrPut(typeName, { JVMStruct(typeName) })
    struct[fieldName] = JVMStruct.Field(fieldName, typeString, offset, static)

    currentEntry += arrayStride
  }

  return structs
}
```

And with a small `main` method to test, we successfully read some data about the `Flag` struct: ![A screenshot of IntelliJ IDEA's debugger, showing information about the Flag struct](/assets/blog/jvm-hackery-noverify/flag-struct.png)

## Reading The Types

Reading the types from the JVM is really similar, but we use the `Type` symbols instead of the `Struct` ones.

We can reuse the `Field`s from the `JVMStruct` map, so our `JVMType` class looks like this:

```kotlin
data class JVMType(
    val type: String, val superClass: String?, val size: Int,
    val oop: Boolean, val int: Boolean, val unsigned: Boolean) {
  val fields = mutableMapOf<String, JVMStruct.Field>()
}
```

And we can walk through the array of types just like we walk through the array of structs:

```kotlin
fun getTypes(structs: Map<String, JVMStruct>): Map<String, JVMType> {
  fun symbol(name: String) = unsafe.getLong(findNative(name))
  fun offsetSymbol(name: String) = symbol("gHotSpotVMTypeEntry${name}Offset")
  fun derefReadString(addr: Long) = unsafe.getString(unsafe.getLong(addr))

  var entry = symbol("gHotSpotVMTypes")
  val arrayStride = symbol("gHotSpotVMTypeEntryArrayStride")

  val types = mutableMapOf<String, JVMType>()

  while (true) {
    val typeName = derefReadString(entry + offsetSymbol("TypeName"))
    if (typeName == null) break

    val superClassName = derefReadString(entry + offsetSymbol("SuperclassName"))

    val size = unsafe.getInt(entry + offsetSymbol("Size"))
    val oop = unsafe.getInt(entry + offsetSymbol("IsOopType")) != 0
    val int = unsafe.getInt(entry + offsetSymbol("IsIntegerType")) != 0
    val unsigned = unsafe.getInt(entry + offsetSymbol("IsUnsigned")) != 0

    val structFields = structs[typeName]?.fields
    types[typeName] = JVMType(
      typeName, superClassName, size,
      oop, int, unsigned
    ).apply {
      if (structFields != null)
        this.fields.putAll(structFields)
    }

    entry += arrayStride
  }

  return types
}
```

And we can inspect our flag *type* now:

![A screenshot of IntelliJ IDEA's debugger, showing information about the Flag type](/assets/blog/jvm-hackery-noverify/flag-type.png)

</section>
<section>

## Putting it all together

Now that we have the internal types of the JVM, we can iterate through all the flags.

The `Flag` struct actually has a field called `flags` which is a C-array of `Flag` structs, so we can just go to the first pointer and work our way through, incrementing the pointer by size of the `Flag` type that we collected in `getTypes`.

```kotlin
data class JVMFlag(val name: String, val address: Long)

fun getFlags(types: Map<String, JVMType>): List<JVMFlag> {
  val jvmFlags = mutableListOf<JVMFlag>()

  val flagType =
    types["Flag"] ?: types["JVMFlag"] ?:
      error("Could not resolve type 'Flag'")
  
  val flagsField =
    flagType.fields["flags"] ?:
      error("Could not resolve field 'Flag.flags'")
  val flags = unsafe.getAddress(flagsField.offset)

  val numFlagsField =
    flagType.fields["numFlags"] ?:
      error("Could not resolve field 'Flag.numFlags'")
  val numFlags = unsafe.getInt(numFlagsField.offset)

  val nameField =
    flagType.fields["_name"] ?:
      error("Could not resolve field 'Flag._name'")
  
  val addrField =
    flagType.fields["_addr"] ?:
      error("Could not resolve field 'Flag._addr'")

  for (i in 0 until numFlags) {
    val flagAddress = flags + (i * flagType.size)
    val flagValueAddress = unsafe.getAddress(flagAddress + addrField.offset)
    val flagNameAddress = unsafe.getAddress(flagAddress + nameField.offset)

    val flagName = unsafe.getString(flagNameAddress)
    if (flagName != null) {
      val flag = JVMFlag(flagName, flagValueAddress)
      jvmFlags.add(flag)
    }
  }

  return jvmFlags
}
```

Then, to disable the bytecode verifier, we can just take our list of flags, find the ones with the names we want, and set the value at their address to 0.

```kotlin
fun disableBytecodeVerifier() {
  val flags = getFlags(getTypes(getStructs()))

  for (flag in flags) {
    if (flag.name == "BytecodeVerificationLocal"
        || flag.name == "BytecodeVerificationRemote") {
      unsafe.putByte(flag.address, 0)
    }
  }
}
```

This disables the two flags, and makes `should_verify_class` return false. Any future class loaded should now skip the verification stage.

## Conclusion: Having Fun

Now that we've forced the JVM to never verify classes, we can do some *wacky* things with weird class bytecode.

Using my Kotlin bytecode assembly DSL, [Koffee](https://github.com/videogame-hacker/Koffee), we can easily use ObjectWeb's ASM to craft a class file and load it into memory once the bytecode verifier has been disabled.

First, we create a ClassLoader that can load from a `ClassNode` (which comes from the `asm-tree` library):

```kotlin
class InMemoryClassLoader(val node: ClassNode, private val cwFlags: Int) : ClassLoader() {
  private val classData by lazy {
    val writer = ClassWriter(cwFlags)
    node.accept(writer)
    writer.toByteArray()
  }

  override fun findClass(name: String): Class<*>? {
    if (name == node.name.replace('/', '.'))
      return defineClass(name, classData, 0, classData.size)
    
    return null
  }

  fun load(): Class<*>? = findClass(node.name.replace('/', '.'))
}
```

Then, we can use *Koffee* to assemble a `ClassNode`, load it into memory, and execute its `main(args)` method:

```kotlin
fun main(args: Array<String>) {
  disableBytecodeVerifier()

  val payloadClass = assembleClass(public, "Payload") {
    method(public + static, "main", void, Array<String>::class) {
      TODO()
    }
  }

  InMemoryClassLoader(payloadClass, COMPUTE_MAXS)
    .load()
    .getDeclaredMethod("main", Array<String>::class.java)
    .invoke(null, args)
}
```

## Examples

Let's look at some sample payloads, their output, and how they're decompiled:

### Local-slot casting

Here, we can save a value to a local variable (with a `Xstore` instruction), and load it through another type's load instruction (`Yload`):

```kotlin
method(public + static, "main", void, Array<String>::class) {
  // Load System.out for printing later
  getstatic(System::class, "out", PrintStream::class)

  dconst_1 // Load 1.0 as a double
  dstore(1) // Store it in slot 1
  lload(1) // Load from slot 1, as a long

  // And print it out:
  invokevirtual(PrintStream::class, "println", void, long)

  _return
}
```

This gives us an output of `4607182418800017408` (the bit-equivalent of the double-precision floating point number 1.0), and decompiles using FernFlower like so:

```java
public class Payload {
    public static void main(String[] var0) {
        double var1 = 1.0D;
        System.out.println((long)var1);
    }
}
```

This is readable, but incorrect. Casting the double `1.0` to a long would result in the long value: `1`.

### Incremental Stack Pushing

When the verifier is enabled in Java, a given location in bytecode must only operate on one stack height. This means that, for example, there cannot exist an instruction `dup` that is jumped to by code that operates on a stack of `[int, int]` and also jumped to by code that operates on a stack of `[int, int, int]`.

This means that normally we're unable to do cool things like looping to push values to the stack.

With `-noverify`, we can:

```kotlin
method(public + static, "main", void, Array<String>::class) {
  bipush(10)
  istore_1 // locals[1] = 10, where locals[1] will be our counter
  +L["loop_start"]
  ldc("Hello, world!") // Push 'Hello, world!' to the stack,
  iinc(1, -1) // and decrement the counter.
  iload_1
  ifne(L["loop_start"]) // If the counter isn't zero yet, go back to the loop head.

  // Then, we emit 10 'println()' calls into the bytecode:
  for (i in 0 until 10) {
    getstatic(System::class, "out", PrintStream::class)
    swap
    invokevirtual(PrintStream::class, "println", void, String::class)
  }

  _return
}
```

This prints 'Hello, world!' out to the console 10 times. And as a bonus, flat-out fails to decompile:

```java
public class Payload {
    public static void main(String[] param0) {
        // $FF: Couldn't be decompiled
    }
}
```

As you can see, with the verifier disabled, it becomes incredibly easy to trip up common bytecode analysis tools.

</section>
<section>

## Epilogue

- Employing this technique seems to work on Windows and Linux, but it seems that macOS's `libjvm.dylib` has its `gHotSpotVM...` symbols set to local-only, meaning that `ClassLoader.findNative(...)` can't resolve the symbols.
- If you are going to do this, it's *much* wiser to use JNI, as accessing the values can be done with a simple `extern void* gHotSpotVMStructs;` instead of using `findNative` and `Unsafe` to read the values.
- Check out the [GitHub repo](https://github.com/char/noverify-hackery) that contains all the work we've done in this post.

</section>

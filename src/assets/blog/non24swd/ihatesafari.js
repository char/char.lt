if (!ReadableStream.prototype[Symbol.asyncIterator]) {
  Object.defineProperty(ReadableStream.prototype, Symbol.asyncIterator, {
    configurable: true,
    writable: true,
    async *value() {
      const reader = this.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) return;
          yield value;
        }
      } finally {
        reader.releaseLock();
      }
    },
  });
}

{
  description = "char.lt";
  inputs = {
    nixpkgs-unstable.url = "github:NixOS/nixpkgs/nixos-unstable";
  };
  outputs =
    { nixpkgs-unstable, ... }@inputs:
    let
      system = "x86_64-linux";
    in
    {
      devShells."${system}".default =
        let
          pkgs = import nixpkgs-unstable { inherit system; };
        in
        pkgs.mkShell {
          packages = [ pkgs.deno ];
        };
    };
}

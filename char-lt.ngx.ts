#!/usr/bin/env -S deno run -A

import ngx from "https://char.lt/ngx/v0.1/ngx.ts";

const commonConfig = (base: string, backend: string) => [
  ["error_page 404 /404.html"],

  ngx("location /", [
    `root ${base}/public`,
    "try_files $uri $uri/index.html @misc",
  ]),
  ngx("location @backend", [
    `proxy_pass ${backend}`,
    "proxy_intercept_errors on",
    "recursive_error_pages on",
    "error_page 404 = @misc",
  ]),
  ngx("location @misc", [`root ${base}/misc`, "try_files $uri =404"]),
];

export const config = ngx("server", [
  ["server_name char.lt", ...ngx.listen(), ...ngx.letsEncrypt("char.lt")],
  ...commonConfig("/srv/www/char.lt", "http://unix:/var/run/char_lt.sock"),
]);
export const path = "char-lt.conf";

export const devConfig = ngx("server", [
  [
    "server_name char.lt",
    ...["8000", "[::]:8000"].map((x) => `listen ${x} default_server`),
  ],
  ...commonConfig("..", "http://127.0.0.1:3001"),
  [
    "add_header Cache-Control no-store",
    "if_modified_since off",
    "expires off",
    "etag off",
  ],
]);

if (import.meta.main) {
  console.log(devConfig.build());
  devConfig.write("./nginx/char-lt.conf");
}

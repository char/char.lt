---
title: "fixing my email like it's 2011"
description: "setting up imapfilter + dovecot + mbsync"
---

quick one today:

email _sucks_ right now. the signal-to-noise ratio is awful and my inbox is constantly littered with things i care very little about. for context about my email setup, after having been burned by running my own mailserver off a VPS from the ages of 16 to 19 i admitted defeat & i'm now on a third-party mail provider for my custom domains[^1], and use plain Thunderbird and iOS Mail for my clients.

[^1]: i don't want to blow up the spot because they're very affordable and generous, but i'm using [Migadu](https://migadu.com/) right now. i have been eyeing [purelymail](https://purelymail.com/) though

spam filtering is nothing new, but i find the binary spam-ham dichotomy lacking - there is some mail that is unequivocally spam, of course, but there's a gradation in terms of "how much do i care about this message" and a contextual flux in "how much do i care about this message _right now_" that i think is collapsed by "yes or no" spam filtering.

so, i wanted to set up my own rules to sort things into separate folders/mailboxes. Migadu has sieve filtering rules on receipt, of course, but i kinda want any setup i invest time into to be provider-agnostic. Thunderbird has built-in sort rules, but i want this to still work e.g. when i'm away from my computer and only on my phone.

so, let's get old-school: [imapfilter](https://github.com/lefcha/imapfilter) is a piece of software initially released when i was ten years old, and seems to be exactly what i need: you write Lua and it does things to your inbox. so let's set it up on my NixOS configuration:

(abridged here, but the full setup is in [my flake](https://git.t4t.associates/char/flake/#commit/41147b9a8787622a98fd5b3090424cde5edd6aa4))

```nix
{ pkgs, ... }: {
  systemd.services.imapfilter = {
    description = "Filter IMAP mail";
    wants = [ "network-online.target" ];
    after = [ "network-online.target" ];
    unitConfig.ConditionPathExists = "/home/charlotte/.config/imapfilter/config.lua";
    serviceConfig = {
      Type = "oneshot";
      User = "charlotte";
      EnvironmentFile = "/var/secrets/imapfilter.env";
      ExecStart = "${pkgs.imapfilter}/bin/imapfilter -c /home/charlotte/.config/imapfilter/config.lua";
    };
  };

  systemd.timers.imapfilter = {
    wantedBy = [ "timers.target" ];
    timerConfig = {
      OnCalendar = "*:0/5";
      Persistent = true;
    };
  };
}
```

one thing to note about this setup is that i set an `EnvironmentFile` for `/var/secrets/imapfilter.env` - we can put creds here and use `os.getenv` from Lua, so that i can [publish my imapfilter rules](https://git.t4t.associates/char/imapfilter-config/) instead of keeping my mail passwords in user-readable plaintext config scripts in my home folder.

unfortunately, a lot of the imapfilter operations don't work against Migadu - it seems that they always return 0 results for bulk searches (e.g. for finding messages with given headers). i tried manually scanning each message in the mailbox, but it was really slow and i don't want to have to do a lengthy operation periodically

so here's the plan: i stay with my mail provider, but i have an _additional_ mail server of my own that does a bidirectional sync to the upstream provider, and serves the bulk queries that i need + full-text search. i also think it could be faster to use directly from my mail clients, but i'll defer that for now. does anything exist that can do this?

turns out, yes: [isync/mbsync](https://github.com/gburd/isync) is software written (as far as i can tell) in or before 2000, which makes it older than _me_! but it's perfect for this use case: i'll just spin up a mail server, mbsync it between my mail provider, and then point imapfilter at the new server.

so, let's set up dovecot (again, [see flake](https://git.t4t.associates/char/topaz-flake/#commit/6cf7d6da3f7fbdfd621e36d5e8f8cce32624cd8b)):

```nix
{ config, pkgs, ... }:
let
  domain = "my-domain.com";
in
{
  # enable acme with http challenge via nginx to get a tls cert
  services.nginx.virtualHosts.${domain} = {
    enableACME = true;
    locations."/".return = "404";
  };
  security.acme.certs.${domain}.reloadServices = [ "dovecot.service" ];
  
  services.dovecot2 = {
    enable = true;
    package = pkgs.dovecot;
    settings = {
      # ...

      "passdb passwd-file".passwd_file_path = "/run/dovecot2/passwd";
      "userdb passwd-file".passwd_file_path = "/run/dovecot2/passwd";

      protocols.imap = true;
      ssl = "required";
      ssl_server_cert_file = "${config.security.acme.certs.${domain}.directory}/fullchain.pem";
      ssl_server_key_file = "${config.security.acme.certs.${domain}.directory}/key.pem";
    };
  };

  # set up passwd file
  # ...
}
```

with mail credentials at `/var/secrets/mail/<account>.password`

and isync:

```nix
{ lib, pkgs, ... }:
let
  accounts = ...;
  passwordFile = ...;
in
{
  # ...

  systemd.services = lib.mapAttrs' (
    name: username:
    let
      mbsyncConfig = pkgs.writeText "mbsync-${name}.conf" ''
        # ... account stuff

        Channel mail
        Far :remote:
        Near :local:
        Patterns *
        Sync All
        Create Both
        Remove Both
        Expunge Both
        CopyArrivalDate yes
        SyncState /var/lib/mail-sync/${name}/
      '';
    in
    lib.nameValuePair "mail-sync-${name}" {
      # ...
      serviceConfig = {
        Type = "oneshot";
        User = "mail-sync";
        StateDirectory = "mail-sync/${name}";
        LoadCredential = [ "password:${passwordFile name}" ];
        ExecStart = "${pkgs.isync}/bin/mbsync --config ${mbsyncConfig} --all";
        # ...
      };
    }
  ) accounts;
}
```

yay :D now i can do things like:

```lua
options.certificates = false
options.create = true
options.subscribe = true

local accounts = dofile(os.getenv('HOME') .. '/.config/imapfilter/accounts.lua')

for _, credentials in ipairs(accounts) do
  local password = os.getenv(credentials.password_env)
  local automated = (inbox:contain_field('List-ID', '')
    + inbox:contain_field('List-Unsubscribe', '')
    + inbox:contain_field('Precedence', ''):match_field('Precedence', [[(?i)^[ \t]*(?:bulk|list)\b]]))
  local success = automated:move_messages(account['automated mail'])
  assert(success, 'Failed to move mail for ' .. credentials.username)
end
```

to move all mail from mailing lists into an "automated mail" mailbox ^-^

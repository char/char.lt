---
title: "Pro tip: Push-to-deploy Git repositories"
description: "'git push' to the web"
---

I recently wrote a [static site generator](https://github.com/videogame-hacker/siru) which, incidentally, powers this site. This means that making a site is pretty easy, but what about putting it online?

If you have your own server, you can easily self-host static websites, just point your HTTP server (I use `nginx`), and use this _pro tip_:

## The push-to-deploy git repo

Setting up a push-to-deploy git repo is really simple - All you need to do is set up a new git repo on the server (with `git init`), and utter the magical incantation:

```bash
git config receive.denyCurrentBranch updateInstead
```

Then, we can just point our webserver at this repository to serve the website. This means our workflow for deploying the website is as simple as `git push`, along with any build steps for your static sites.

(**Note:** You probably want to deny access to the `.git` folder of your site, for security reasons. This matters a whole lot more for dynamic sites than static ones, but it's still good to not let people into your commit history if you don't want them to be. An example I remember of abusing `.git` access via web is from the Overwatch: Sombra ARG, where we read the `.git` folder of a PHP application to view the sources.)

I use this option for `som.codes` - With the remote-linked repo in the `build` folder, a [deploy.sh](https://github.com/videogame-hacker/som.codes/blob/master/deploy.sh) script does the following:

```bash
rm -rf build/*
make
(cd build/ && git add -A . && git commit -m "[Auto] Deploy $(date)" && git push)
```

## Other options: Managed hosting

Services like [GitHub](https://pages.github.com/) and [GitLab](https://about.gitlab.com/product/pages/) offer free hosting of static sites (even on your own domain!), with the same git-push-to-deploy UX you can find here. If you don't want to manage your own server, this is a great option.

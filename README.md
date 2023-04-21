## Why this plugin

In the context of a Yarn 2+ monorepo with workspaces, you are supposed to have only one top-level `yarn.lock` file at the root of your monorepo.

You cannot create `yarn.lock` at package level, because they will be isolated from the rest of the monorepo, defeating the purpose of workspaces and disabling package hoisting.

Yet, you may need to generate individual lockfiles when publishing your packages, especially when they are applications or repos that may be published
in individual read-only repositories.

See https://github.com/yarnpkg/berry/issues/1223 for more details.

## Install

-   `yarn plugin import https://raw.githubusercontent.com/eggplants/yarn-plugin-deploy-lockfiles/main/bundles/%40yarnpkg/plugin-deploy-lockfiles.js`

Example:

```json
"workspaces": {
    "packages": [
      "packages/*",
      "starters/*",
      "docusaurus"
    ]
  },
```

Eeach folder listed in the workspace will get a `yarn.lock` file generated inside of it.

## Run

Simply run `yarn`: you'll see a few lockfiles popping out at each workspace folder.
You can use those lockfiles as you wish, for example by setting

    YARN_LOCKFILE_FILENAME=yarn.lock

to use them as the main lockfile for deployment.

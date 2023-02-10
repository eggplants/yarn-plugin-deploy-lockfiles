import { Cache, Project, structUtils, ThrowReport, Workspace } from '@yarnpkg/core';
import { ppath, xfs } from '@yarnpkg/fslib';
import * as globrex from 'globrex';

import type { Filename, PortablePath } from '@yarnpkg/fslib';
import type { Configuration, Hooks, Report } from '@yarnpkg/core';

const green = (text: string) => `\x1b[32m${text}\x1b[0m`;
const grey = (text: string) => `\x1b[30m${text}\x1b[0m`;

const afterAllInstalled: Hooks['afterAllInstalled'] = async (project, options) => {
  const ws = project.workspacesByCwd.get(project.configuration.startingCwd);
  await options.report.startTimerPromise(`Deployment lockfiles (${ws.relativeCwd})`, () =>
    generateLockfiles(project.configuration, project, options.report)
  );
};

async function generateLockfiles(configuration: Configuration, project: Project, report: Report) {
  const startingWs = project.workspacesByCwd.get(project.configuration.startingCwd);
  const cache = await Cache.find(configuration, { immutable: true });
  const deployments = startingWs.relativeCwd === '.' ? await getDeployments(project) : [startingWs];
  const workspaceReferences = new Set(deployments.map(d => 'workspace:' + d.relativeCwd));

  await Promise.all(
    deployments.map(async workspace => {
      const lockfileName = `yarn.deploy.lock` as Filename;
      const lockfilePath = ppath.join(workspace.cwd, lockfileName);

      const lockfile = await generateLockfile(configuration, workspace.cwd, cache, workspaceReferences);
      let diff = false;
      try {
        const stat = await xfs.statPromise(lockfilePath);
        if (stat.size != lockfile.length) {
          const existingContent = (await xfs.readFilePromise(lockfilePath)).toString();
          diff = existingContent !== lockfile;
        }
      } catch (e) {
        diff = true;
      }

      if (diff) {
        await xfs.writeFilePromise(lockfilePath, lockfile);
        report.reportInfo(
          null,
          `${structUtils.stringifyIdent(workspace.locator)} => ` + green(`Writing ${lockfileName}`)
        );
      } else {
        report.reportInfo(null, `${structUtils.stringifyIdent(workspace.locator)} => ` + grey('No change'));
      }
    })
  );
}

async function getDeployments(project: Project) {
  const rootWorkspace = project.workspacesByCwd.get(project.cwd);
  const deploymentPatterns = rootWorkspace.manifest.workspaceDefinitions.map(
    glob => globrex(glob.pattern, { globstar: true, extended: true }).regex
  );

  const isEntrypoint = (workspace: Workspace) => deploymentPatterns.some(regexp => regexp.test(workspace.relativeCwd));
  return project.workspaces.filter(isEntrypoint);
}

async function generateLockfile(
  configuration: Configuration,
  workspaceCwd: PortablePath,
  cache: Cache,
  workspaceReferences: Set<string>
) {
  // Always create a new instance of Project to avoid interference of its internal state
  const { project, workspace } = await Project.find(configuration, workspaceCwd);

  // Focus on only one workspace - I'm not sure whether this can cause some problems but it looks like it works
  project.workspaces = [workspace];

  await project.resolveEverything({ cache, report: new ThrowReport() });

  const workSpaceRef = 'workspace:' + workspace.relativeCwd;
  for (const pkg of project.originalPackages.values()) {
    if (pkg.reference == workSpaceRef) {
      pkg.reference = 'workspace:.';
      continue;
    }
    if (workspaceReferences.has(pkg.reference)) {
      pkg.reference;
    }
  }

  for (const descriptor of project.storedDescriptors.values()) {
    if (descriptor.range == workSpaceRef) {
      descriptor.range = 'workspace:.';
      continue;
    }
  }

  return project.generateLockfile();
}

export default { hooks: { afterAllInstalled } };

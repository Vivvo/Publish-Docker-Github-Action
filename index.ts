import * as core from '@actions/core';
import * as proc from 'child_process';
import axios from 'axios';

// https://medium.com/@ali.dev/how-to-use-promise-with-exec-in-node-js-a39c4d7bbf77
function execShellCommand(cmd): Promise<string> {
  // console.log(cmd);
  return new Promise((resolve, reject) => {
    proc.exec(cmd, (error, stdout, stderr) => {
    if (error) {
      console.warn(error, stdout, stderr);
      reject(error.message);
    }
    resolve(stdout? stdout : stderr);
    });
  });
}

function getTags(): string[] {
  let tags = core.getInput('tags').replace(' ', '').split(',');
  if (tags.length != 1 || tags[0] != '') {
    return tags;
  }
  const tag = process.env.GITHUB_REF;
  if (isGitTag(tag)) {
    return [tag.replace('refs/tags/', '')];
  }
  if (isPullRequest(tag)) {
    return [tag.replace('refs/pull/', '')];
  }
  return [tag.replace('refs/heads/', '') + '-' + process.env.GITHUB_SHA.substring(0, 7)];
}

function isPullRequest(githubRef:string): boolean {
  return githubRef.includes('refs/pull');
}

function isGitTag(githubRef:string): boolean {
  return githubRef.includes('refs/tags');
}

// most @actions toolkit packages have async methods
async function run() {
  const name = core.getInput('name');
  await dockerLogin();
  let output = "";
  try {
    let params = "";
    // for ARG in $(echo "${INPUT_BUILDARGS}" | tr ',' '\n'); do
    // BUILDPARAMS="${BUILDPARAMS} --build-arg ${ARG}"
    let args = core.getInput('buildargs').replace(' ','').split(',');
    console.debug(`Params: ${args}`);
    for (let param of args) {
      params = `${params} --build-arg ${param}`;
    }
    output = await execShellCommand(`docker build ${core.getInput('workdir')} ${params}`);
  } catch {
    sendError(name, `failed to build`);
  }
  
  let id = output.split('\n').slice(-2)[0].split(' ').slice(-1)[0];

  for (let tag of getTags()) {
    try {
      await execShellCommand(`docker tag ${id} ${name}:${tag}`);
      await execShellCommand(`docker push ${name}:${tag}`);
    } catch (error) {
      sendError(name, 'failed to tag or push')
    }
  };

  await execShellCommand(`docker logout ${core.getInput('registry')}`);
}

async function dockerLogin(){
  const username = core.getInput('username');
  const registry = core.getInput('registry');
  const password = core.getInput('password')
  await execShellCommand(
    `bash -c 'echo ${password} | docker login -u ${username} --password-stdin ${registry}'`,
  );
}

async function sendError(title: string, message: string) {
  const url = `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  await axios.post(`https://keybase-webhook.vivvocloud.com/hook/4zrd5he22wwsqwqz`, {text: `${title}\n${url}\n${message}`})
  core.setFailed(message);
  process.exit(1);
}

run()

#!/bin/sh
set -e

SHORT_HASH=${GITHUB_SHA:0:7}

main() {
  echo "" # see https://github.com/actions/toolkit/issues/168

  if usesBoolean "${ACTIONS_STEP_DEBUG}"; then
    echo "::add-mask::${INPUT_USERNAME}"
    echo "::add-mask::${INPUT_PASSWORD}"
    set -x
  fi
  
  sanitize "${INPUT_NAME}" "name"
  sanitize "${INPUT_USERNAME}" "username"
  sanitize "${INPUT_PASSWORD}" "password"

  registryToLower
  nameToLower

  REGISTRY_NO_PROTOCOL=$(echo "${INPUT_REGISTRY}" | sed -e 's/^https:\/\///g')
  if uses "${INPUT_REGISTRY}" && ! isPartOfTheName "${REGISTRY_NO_PROTOCOL}"; then
    INPUT_NAME="${REGISTRY_NO_PROTOCOL}/${INPUT_NAME}"
  fi

  if uses "${INPUT_TAGS}"; then
    TAGS=$(echo "${INPUT_TAGS}" | sed "s/,/ /g")
  else 
    translateDockerTag
  fi

  if uses "${INPUT_WORKDIR}"; then
    changeWorkingDirectory
  fi

  echo "${INPUT_PASSWORD}" | docker login -u ${INPUT_USERNAME} --password-stdin ${INPUT_REGISTRY}

  FIRST_TAG=$(echo "${TAGS}" | cut -d ' ' -f1)
  DOCKERNAME="${INPUT_NAME}:${FIRST_TAG}"
  BUILDPARAMS=""
  CONTEXT="."

  if uses "${INPUT_DOCKERFILE}"; then
    useCustomDockerfile
  fi
  if uses "${INPUT_BUILDARGS}"; then
    addBuildArgs
  fi
  if uses "${INPUT_CONTEXT}"; then
    CONTEXT="${INPUT_CONTEXT}"
  fi
  if usesBoolean "${INPUT_CACHE}"; then
    useBuildCache
  fi
  if usesBoolean "${INPUT_SNAPSHOT}"; then
    useSnapshot
  fi

  push

  echo "::set-output name=tag::${FIRST_TAG}"
  DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' ${DOCKERNAME})
  echo "::set-output name=digest::${DIGEST}"

  docker logout
}

sanitize() {
  if [ -z "${1}" ]; then
    >&2 echo "Unable to find the ${2}. Did you set with.${2}?"
    exit 1
  fi
}

registryToLower(){
 INPUT_REGISTRY=$(echo "${INPUT_REGISTRY}" | tr '[A-Z]' '[a-z]')
}

nameToLower(){
  INPUT_NAME=$(echo "${INPUT_NAME}" | tr '[A-Z]' '[a-z]')
}

isPartOfTheName() {
  [ $(echo "${INPUT_NAME}" | sed -e "s/${1}//g") != "${INPUT_NAME}" ]
}

translateDockerTag() {
  local BRANCH=$(echo "${GITHUB_REF}" | sed -e "s/refs\/heads\///g" | sed -e "s/\//-/g")
  if hasCustomTag; then
    TAGS=$(echo "${INPUT_NAME}" | cut -d':' -f2)
    INPUT_NAME=$(echo "${INPUT_NAME}" | cut -d':' -f1)
  elif isOnMaster; then
    TAGS=$(echo "master-${SHORT_HASH}")
  elif isGitTag && usesBoolean "${INPUT_TAG_SEMVER}" && isSemver "${GITHUB_REF}"; then
    TAGS=$(echo "${GITHUB_REF}" | sed -e "s/refs\/tags\///g" | sed -E "s/v?([0-9]+)\.([0-9+])\.([0-9]+)(-[a-zA-Z]+(\.[0-9]+)?)?/\1.\2.\3\4 \1.\2\4 \1\4/g")
  elif isGitTag && usesBoolean "${INPUT_TAG_NAMES}"; then
    TAGS=$(echo "${GITHUB_REF}" | sed -e "s/refs\/tags\///g")
  elif isGitTag; then
    TAGS="latest"
  elif isPullRequest; then
    TAGS=$(echo "${BRANCH}-PR-${SHORT_HASH}")
  else
    TAGS=$(echo "${BRANCH}-${SHORT_HASH}")
  fi;
}

hasCustomTag() {
  [ $(echo "${INPUT_NAME}" | sed -e "s/://g") != "${INPUT_NAME}" ]
}

isOnMaster() {
  [ "${BRANCH}" = "master" ]
}

isGitTag() {
  [ $(echo "${GITHUB_REF}" | sed -e "s/refs\/tags\///g") != "${GITHUB_REF}" ]
}

isPullRequest() {
  [ $(echo "${GITHUB_REF}" | sed -e "s/refs\/pull\///g") != "${GITHUB_REF}" ]
}

changeWorkingDirectory() {
  cd "${INPUT_WORKDIR}"
}

useCustomDockerfile() {
  BUILDPARAMS="${BUILDPARAMS} -f ${INPUT_DOCKERFILE}"
}

addBuildArgs() {
  for ARG in $(echo "${INPUT_BUILDARGS}" | tr ',' '\n'); do
    BUILDPARAMS="${BUILDPARAMS} --build-arg ${ARG}"
    echo "::add-mask::${ARG}"
  done
}

useBuildCache() {
  if docker pull "${DOCKERNAME}" 2>/dev/null; then
    BUILDPARAMS="${BUILDPARAMS} --cache-from ${DOCKERNAME}"
  fi
}

uses() {
  [ ! -z "${1}" ]
}

usesBoolean() {
  [ ! -z "${1}" ] && [ "${1}" = "true" ]
}

isSemver() {
  echo "${1}" | grep -Eq '^refs/tags/v?([0-9]+)\.([0-9+])\.([0-9]+)(-[a-zA-Z]+(\.[0-9]+)?)?$'
}

useSnapshot() {
  local TIMESTAMP=`date +%Y%m%d%H%M%S`
  local SHORT_SHA=$(echo "${GITHUB_SHA}" | cut -c1-6)
  local SNAPSHOT_TAG="${TIMESTAMP}${SHORT_SHA}"
  TAGS="${TAGS} ${SNAPSHOT_TAG}"
  echo "::set-output name=snapshot-tag::${SNAPSHOT_TAG}"
}

push() {
  local BUILD_TAGS=""
  for TAG in ${TAGS}; do
    BUILD_TAGS="${BUILD_TAGS}-t ${INPUT_NAME}:${TAG} "
  done
  docker build ${INPUT_BUILDOPTIONS} ${BUILDPARAMS} ${BUILD_TAGS} ${CONTEXT}

  for TAG in ${TAGS}; do
    docker push "${INPUT_NAME}:${TAG}"
  done
}

main

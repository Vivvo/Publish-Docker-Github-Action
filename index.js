"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var core = require("@actions/core");
var proc = require("child_process");
var axios_1 = require("axios");
require('dotenv').config();
// https://medium.com/@ali.dev/how-to-use-promise-with-exec-in-node-js-a39c4d7bbf77
function execShellCommand(cmd) {
    console.log(cmd);
    return new Promise(function (resolve, reject) {
        proc.exec(cmd, function (error, stdout, stderr) {
            if (error) {
                console.warn(error, stdout, stderr);
                reject(error.message);
            }
            resolve(stdout ? stdout : stderr);
        });
    });
}
function getTags() {
    var tags = core.getInput('tags').replace(' ', '').split(',');
    if (tags.length != 1 || tags[0] != '') {
        return tags;
    }
    var tag = process.env.GITHUB_REF;
    console.log('tag', tag);
    if (isGitTag(tag)) {
        return [tag.replace('refs/tags/', '')];
    }
    if (isPullRequest(tag)) {
        return [tag.replace('refs/pull/', '')];
    }
    return [tag.replace('refs/heads/', '') + '-' + process.env.GITHUB_SHA.substring(0, 7)];
}
function isPullRequest(githubRef) {
    return githubRef.includes('refs/pull');
}
function isGitTag(githubRef) {
    return githubRef.includes('refs/tags');
}
// most @actions toolkit packages have async methods
function run() {
    return __awaiter(this, void 0, void 0, function () {
        var name, nameToLower, output, id, _i, _a, tag;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    name = core.getInput('name');
                    nameToLower = core.getInput('name').toLowerCase();
                    return [4 /*yield*/, dockerLogin()];
                case 1:
                    _b.sent();
                    return [4 /*yield*/, execShellCommand("docker build " + core.getInput('workdir'))];
                case 2:
                    output = _b.sent();
                    console.log(output);
                    id = output.split('\n').slice(-2)[0].split(' ').slice(-1)[0];
                    console.log('id', '|' + id + '|');
                    _i = 0, _a = getTags();
                    _b.label = 3;
                case 3:
                    if (!(_i < _a.length)) return [3 /*break*/, 7];
                    tag = _a[_i];
                    return [4 /*yield*/, execShellCommand("docker tag " + id + " " + name + ":" + tag)];
                case 4:
                    _b.sent();
                    return [4 /*yield*/, execShellCommand("docker push " + name + ":" + tag)];
                case 5:
                    _b.sent();
                    _b.label = 6;
                case 6:
                    _i++;
                    return [3 /*break*/, 3];
                case 7:
                    ;
                    return [4 /*yield*/, execShellCommand("docker logout " + core.getInput('registry'))];
                case 8:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function dockerLogin() {
    return __awaiter(this, void 0, void 0, function () {
        var username, registry, password;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    username = process.env.INPUT_USERNAME;
                    registry = process.env.INPUT_REGISTRY;
                    password = process.env.INPUT_PASSWORD;
                    return [4 /*yield*/, execShellCommand("bash -c 'echo " + password + " | docker login -u " + username + " --password-stdin " + registry + "'")];
                case 1:
                    _a.sent();
                    console.info('logged in');
                    return [2 /*return*/];
            }
        });
    });
}
function sendError(title, message) {
    return __awaiter(this, void 0, void 0, function () {
        var url;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    url = "https://github.com/" + process.env.GITHUB_REPOSITORY + "/actions/runs/" + process.env.GITHUB_RUN_ID;
                    return [4 /*yield*/, axios_1["default"].post("https://keybase-webhook.vivvocloud.com/hook/4zrd5he22wwsqwqz", { text: title + "\n" + url + "\n" + message })];
                case 1:
                    _a.sent();
                    core.setFailed(message);
                    process.exit(1);
                    return [2 /*return*/];
            }
        });
    });
}
run();

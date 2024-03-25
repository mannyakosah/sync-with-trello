import * as core from "@actions/core";
import * as github from "@actions/github";

const { context = {} } = github;
const { pull_request, head_commit, ref } = context.payload;

const regexPullRequest = /Merge pull request \#\d+ from/g;
const trelloCardIdPattern =
  core.getInput("trello-card-id-pattern", { required: false }) || "#";
const trelloApiKey = core.getInput("trello-api-key", { required: true });
const trelloAuthToken = core.getInput("trello-auth-token", { required: true });

function getBranchName(ref) {
  console.log(`getBranchName(${ref})`);
  return ref.replace("refs/heads/", "");
}

function getTrelloCardIdFromBranchName(branchName) {
  console.log(`getTrelloCardIdFromBranchName(${branchName})`);
  return branchName.split("-")[-1];
}

async function handleHeadCommit(data) {
  console.log("handleHeadCommit", data);
  let attachement_url = data.url;

  const cardId = getTrelloCardIdFromBranchName(getBranchName(ref));
  const api_route = "https://api.trello.com/1/cards/" + cardId + "/attachments";
  const response = await fetch(api_route, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      key: trelloApiKey,
      token: trelloAuthToken,
      url: attachement_url,
    }),
  });

  console.log("response", response);

  if (response.status == 200) {
    console.log("Attachment added successfully");
  } else {
    console.log("Error adding attachment");
  }
}

async function run() {
  if (head_commit && head_commit.message) {
    handleHeadCommit(head_commit);
  }
}

run();

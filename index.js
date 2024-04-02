const core = require("@actions/core");
const github = require("@actions/github");
const fetch = require("node-fetch");

const { context = {} } = github;
const { pull_request, head_commit, ref } = context.payload;

const trelloApiKey = core.getInput("trello-api-key", { required: true });
const trelloAuthToken = core.getInput("trello-auth-token", { required: true });
const trelloBoardId = core.getInput("trello-board-id", {
  required: true,
});
const trelloReviewListName = core.getInput("trello-review-list-name", {
  required: false,
});
const trelloCompletedListName = core.getInput("trello-completed-list-name", {
  required: false,
});

function getTrelloCardId() {
  if (pull_request) {
    var stringWithBranchName = pull_request.head.ref;
    return retrieveAlphanumericSubstring(stringWithBranchName);
  } else {
    // when pull_request is undefined, event could be a commit or a merge.
    // if it's a commit, we extract the trello card id from the ref (branch name)
    // if it's a merge, we extract the trello card id from the merge commit message
    return (
      retrieveAlphanumericSubstring(ref) ||
      retrieveAlphanumericSubstring(head_commit.message)
    );
  }
}

function retrieveAlphanumericSubstring(inputString) {
  //regular expression pattern to match '#' followed by 8 alphanumeric characters
  var pattern = /#[a-zA-Z0-9]{8}\b/g;
  var matches = inputString.match(pattern);
  if (matches && matches.length > 0) {
    return matches[0].substring(1);
  } else {
    return null;
  }
}

async function addAttachmentToCard(cardId, attachmentUrl) {
  const api_route = "https://api.trello.com/1/cards/" + cardId + "/attachments";
  const response = await fetch(api_route, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      key: trelloApiKey,
      token: trelloAuthToken,
      url: attachmentUrl,
    }),
  });

  if (response.status == 200) {
    console.log(
      "Successfully attached commit link to Trello card:" + cardId + " ."
    );
  } else {
    console.log("Error adding attachment");
  }
}

async function getListId(listName) {
  let api_route = `https://trello.com/1/boards/${trelloBoardId}/lists`;
  const response = await fetch(
    api_route +
      "?" +
      new URLSearchParams({
        key: trelloApiKey,
        token: trelloAuthToken,
      }),
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  if (response.status == 200) {
    const listIds = await response.json();
    let result = listIds.find((l) => l.closed == false && l.name == listName);
    if (result) {
      return result.id;
    } else {
      console.log("Id of list:", listName, "not found.");
      return null;
    }
  } else {
    console.log("Could not find list" + listName + "on board:", boardId + ".");
  }
}

async function moveCardToList(cardId, listName) {
  const listId = await getListId(listName);
  if (!listId) {
    return;
  }
  const api_route = "https://api.trello.com/1/cards/" + cardId;
  const response = await fetch(api_route, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      key: trelloApiKey,
      token: trelloAuthToken,
      idList: listId,
    }),
  });

  if (response.status == 200) {
    console.log(
      "Successfully moved Trello card: " +
        cardId +
        " to list: " +
        listName +
        " ."
    );
  } else {
    console.log("Error moving card", cardId, " to list", listName, listId);
  }
}

async function handleHeadCommit(data) {
  let attachment_url = data.url;
  await addAttachmentToCard(cardId, attachment_url);
}

async function handlePullRequest(data) {
  const prUrl = data.html_url || data.url;
  await addAttachmentToCard(cardId, prUrl);
  console.log("Pull request is:", data.state);
  console.log("Trello review list name:", trelloReviewListName);
  if (data.state == "open" && trelloReviewListName) {
    await moveCardToList(cardId, trelloReviewListName);
  }
}

async function handleMergeCommit() {
  console.log("Trello completed listname:", trelloCompletedListName);
  await moveCardToList(cardId, trelloCompletedListName);
}

async function run() {
  if (
    head_commit &&
    head_commit.message &&
    head_commit.message.includes("Merge pull request")
  ) {
    handleMergeCommit(head_commit);
  } else if (head_commit) {
    handleHeadCommit(head_commit);
  } else if (pull_request) {
    handlePullRequest(pull_request);
  }
}

console.log("Pull request payload:", pull_request);
console.log("Commit payload:", head_commit);

const cardId = getTrelloCardId();
if (cardId) {
  console.log("Trello card id provided: ", cardId);
  run();
} else {
  console.log(
    "Trello card id not found in branch name. Will not sync with Trello."
  );
}

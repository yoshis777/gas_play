// グローバル変数（設定事項、入力値の管理変数）
var SHEET = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Jinro')
var VERIFYED_TOKEN = PropertiesService.getScriptProperties().getProperty('verified_token');
var OAUTH_TOKEN = PropertiesService.getScriptProperties().getProperty('OAuth_token')
var E;

//汎用メソッド========================================
function getParameter(paramName){
  return E.parameter[paramName] || JSON.parse(E.parameter.payload)[paramName] || null;
}

function authenticate(token) {
  if (VERIFYED_TOKEN != token) {
    throw new Error("invalid token.")

    return ContentService.createTextOutput()
  }
}

function replyMessage(message) {
  var response = {text: message};

  return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
}

function createDialogObj(e){
  var trigger_id = getParameter('trigger_id')
  var token = OAUTH_TOKEN
  var dialog = {
    "token": token, // OAuth_token
    "trigger_id": trigger_id,
    "dialog": JSON.stringify({
      "callback_id": "rule_dialog",
      "title": "ニューゲーム",
      "submit_label": "決定",
      "elements": [
        {
          "type": "select",
          "label": "ゲーム",
          "name": "game",
          "options": [
            {
              "label": "エピソード人狼",
              "value": "episode"
            },
            {
              "label": "ワードウルフ",
              "value": "word"
            }
          ]
        },
        {
          "type": "text",
          "subtype": "number",
          "label": "プレイヤー人数",
          "name": "numberOfPlayer",
          "value": "4"
        },
        {
          "type": "text",
          "subtype": "number",
          "label": "人狼の数",
          "name": "numberOfWolf",
          "value": "1"
        }
      ]
    })
  };
  return dialog;
}

function openDialog(e) {
  var options = {
    'method' : 'POST',
    'payload' : createDialogObj(e),
  };
  var slackUrl = "https://slack.com/api/dialog.open";
  var response = UrlFetchApp.fetch(slackUrl, options);
  return ContentService.createTextOutput();
}

function setDialogData(e) {
  var data = JSON.parse(E.parameter.payload).submission
  initialize()
  setNumber(data.numberOfPlayer, data.numberOfWolf)

  return ContentService.createTextOutput();
}

function initialize() {
  //行番号、行数
  SHEET.deleteRows(2, 100)
  SHEET.insertRows(2, 100)
}

function setNumber(numberOfPlayer, numberOfWolf) {
  var numberOfPlayer = parseInt(numberOfPlayer, 10)
  var numberOfWolf = parseInt(numberOfWolf, 10)
  var jinroArray = createJinroArray(numberOfPlayer, numberOfWolf)

  for(var i = 1; i <= numberOfPlayer; i++) {
    SHEET.appendRow([i, '', jinroArray[i - 1]])
  }
}

function createJinroArray(numberOfPlayer, numberOfWolf) {
  var arr = []
  var numberOfMura = numberOfPlayer - numberOfWolf
  for(var i = 1; i <= numberOfWolf; i++) {
    arr.push('人狼')
  }
  for(var i = 1; i <= numberOfMura; i++) {
    arr.push('村人')
  }

  return shuffle(arr)
}

function shuffle(array){
  var result = [];
  for(i = array.length; i > 0; i--){
    var index = Math.floor(Math.random() * i);
    var val = array.splice(index, 1)[0];
    result.push(val);
  }

  return result;
}

function findRow(data,val){
  for(var i=0; i<data.length; i++){
    if (val === '') {
      if(data[i].length === 0 || data[i][0] === val){
        return i+1;
      }
    } else {
      if(data[i][0] === val){
        return i+1;
      }
    }
  }
  return 0;
}
//=================================================

function doPost(e) {
  E = e
  authenticate(getParameter('token'))

  if (isJinroCommand()) {
    return selectMode()
  } else {
    return setDialogData(e)
  }
}

function isJinroCommand() {
  return getParameter('command') === '/jinro'
}

function selectMode() {
  var keyword = keywordization()
  keyword = Object.assign(keyword, extractKeyword(keyword['text']))

  if (keyword['newGame']) { return openDialog(E) }
  if (keyword['myRole']) { return showYourRole(getUserName()) }

  return replyMessage('無効な引数です\nニューゲーム\n配役')
}

function getUserName() {
  return getParameter('user_name')
}

function showYourRole(userName) {
  return replyMessage(yourRole(userName))
}

function yourRole(userName) {
  var numberOfPlayer = SHEET.getDataRange().getLastRow() - 1
  var playerList = SHEET.getRange(2, 2, numberOfPlayer, 1).getValues()

  var registeredRow = findRow(playerList, userName)
  if (registeredRow) {
    return SHEET.getRange(registeredRow + 1, 3).getValue()
  } else {
    var blankRow = findRow(playerList, '')
    if (!blankRow) { return '既に人数分登録されています。' }

    SHEET.getRange(blankRow + 1, 2, 1, 1).setValue(userName)
    return SHEET.getRange(blankRow + 1, 3).getValue()
  }
}

function keywordization() {
  var keyword = []

  keyword['text'] = getParameter('text')
  keyword['command'] = getParameter('command')

  return keyword
}

function extractKeyword(text) {
  var keyword = []

  if (text.indexOf('配役') != -1) { keyword['myRole'] = true }
  if (text.indexOf('ニューゲーム') != -1) { keyword['newGame'] = true }
  if (text.indexOf('初期化') != -1) { keyword['initialize'] = true }

  return keyword
}

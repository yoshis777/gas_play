// グローバル変数（設定事項、初期値）
var VERIFYED_TOKEN = PropertiesService.getScriptProperties().getProperty('verified_token');
var SLACK_SERVICE_URL = PropertiesService.getScriptProperties().getProperty('slack_service_url')

var FIRST_MONEY = 1000
var TARGET_SHEET = 'Points'
var SLOT_PARTS = [':stamp1:', ':stamp2:', ':stamp3:']
var ODDS = {
  ':stamp1:': 10,
  ':stamp2:': 0.5,
  ':stamp3:':5,
}

var BIG_SLOT_PARTS = [':m_stamp1:', ':m_stamp2:', ':m_stamp3:', ':m_stamp4:', ':m_stamp5:', ':m_stamp6:', ':m_stamp7:']
var ODDS_TABLE = {
  ':m_stamp1:': 100,
  ':m_stamp2:': 20,
  ':m_stamp3:': 6,
  ':m_stamp4:': 4,
  ':m_stamp5:': 2,
  ':m_stamp6:': 1,
  ':m_stamp7:': 0.5,
}

var HOW_TO_SLOT = [
  'スロット： ３つ揃えば賞金',
  'スロットオッズ： 絵柄のオッズ確認',
  'スロット大11: ヨコ３つかナナメ３つ揃えば賞金',
  'スロット大11オッズ: 絵柄のオッズ確認',
  'スロットBET(数字): 初回なら、1000ペリカもらえる',
  'スロットBET(数字): ２回目以降なら、(数字)分の賞金を賭ける',
]

function doPost(e) {
  if ('MsTPMgCsbY1PfyBJHszPC9ab' != e.parameter.token) {
    throw new Error("invalid token.")
  }

  selectFunction(e)
}

function postSlack(text){
  var url = SLACK_SERVICE_URL
  var options = {
    "method" : "POST",
    "headers": {"Content-type": "application/json"},
    "payload" : '{"text":"' + text + '"}'
  }
  UrlFetchApp.fetch(url, options)
}

function doSlot(e) {
  var resultParts = createResultParts()
  var sheet = readSheet()
  var memberData = findRow(sheet, e.parameter.user_name, 1)

  if (memberData) {
    if (memberData['data'][1] <= 0) {
      postSlack(':comment_stamp: You are dead')
      return
    } else if (memberData['data'][2] === 0) {
      postSlack(':comment_stamp: It needs BET!')
      return
    }

    var result = outputText(resultParts)
    postSlack(result)

    var bet = memberData['data'][2]
    if (resultParts.every(function(v) { return v === resultParts[0]})){
      var reward = bet * ODDS[resultParts[0]]
      var balance = update(sheet, e.parameter.user_name, -1 * reward)
      postSlack('HIT! you got $' + reward + 'as reward.\n\nYou have  $' + balance + ' left.')
    } else {
      var balance = update(sheet, e.parameter.user_name, bet)
      if (balance <= 0) {
        postSlack(':comment_stamp:Oh! You have run out of blance.')
      } else {
        postSlack(':comment_stamp: Lose... You have $' + balance + ' left.')
      }
    }

    update(sheet, e.parameter.user_name, 0)
  } else {
    var result = outputText(resultParts)
    postSlack(result)
  }
}

function doBet(e, value) {
  var sheet = readSheet()
  var memberData = findRow(sheet, e.parameter.user_name, 1)

  if(memberData) {
    if (memberData['data'][1] <= 0) {
      postSlack(':comment_stamp: You are dead')
    } else if (memberData['data'][2] > 0) {
      postSlack('You are already betting dollars. Turn the slot.')
    } else if (value <= 0){
      postSlack(':comment_stamp: You bet no money!? Go back please.')
    } else if (memberData['data'][1] < value) {
      postSlack('You can\'t bet more than you have. You have $' + memberData['data'][1] + ' left.')
    } else if (value < 100) {
      postSlack(':comment_stamp: Bet more dollars.')
    } else {
      point = update(sheet, e.parameter.user_name, value, true)
      postSlack('You bet $'  + parseInt(value, 10) + ' from $' + point + '. Turn the slot.')
    }
  } else {
    var balance = insert(sheet, e.parameter.user_name)
    postSlack('Welcome to this game. You have $' + balance + '.')
  }
}

function doBigSlot(e) {
  var resultParts = createBigResultParts()
  var sheet = readSheet()
  var memberData = findRow(sheet, e.parameter.user_name, 1)

  if (memberData) {
    if (memberData['data'][1] <= 0) {
      postSlack(':comment_stamp: You are dead')
      return
    } else if (memberData['data'][2] === 0) {
      postSlack(':comment_stamp: It needs BET!')
      return
    }

    var bet = memberData['data'][2]
    var result = isHit(resultParts)

    postSlack(outputBigText(resultParts))

    if (result){
      var reward = bet * result
      var balance = update(sheet, e.parameter.user_name, -1 * reward)
      postSlack('HIT! you got $' + reward + 'as reward.\n\nYou have  $' + balance + ' left.')
    } else {
      var balance = update(sheet, e.parameter.user_name, bet)
      if (balance <= 0) {
        postSlack(':comment_stamp:Oh! You have run out of blance.')
      } else {
        postSlack(':comment_stamp: Lose... You have $' + balance + ' left.')
      }
    }

    update(sheet, e.parameter.user_name, 0)
  } else {
    if (isHit(resultParts)) {
      Logger.log(outputBigText(resultParts) + '\n' + 'Hit.')
    } else {
      Logger.log(outputBigText(resultParts) + '\n' + 'Lose.')
    }
  }
}

function selectFunction(e) {
  if (!e) return

  isMatch = e.parameter.text.match(/BET(\d+)/)

  if (e.parameter.text.match(/:sosei:/)) {
    sosei(e)
  } else if (e.parameter.text.match(/やり方|help|man/)) {
    postSlack(outputTextArray(HOW_TO_SLOT))
  } else if (isMatch) {
    doBet(e, isMatch[1])
  } else if (e.parameter.text === 'スロット大') {
    doBigSlot(e)
  } else if (e.parameter.text === 'スロット大オッズ') {
    postSlack(showHitList(ODDS_TABLE))
  } else if (e.parameter.text === 'スロットオッズ') {
    postSlack(showHitList(ODDS))
  } else if(e.parameter.text === 'スロット') {
    doSlot(e)
  }
}

function sosei(e) {
  var resultParts = createBigResultParts()
  var sheet = readSheet()
  var memberData = findRow(sheet, e.parameter.user_name, 1)

  if(!memberData) {
    postSlack('Welcome to this game.')
    insert(sheet, e.parameter.user_name)
  } else {
    if (memberData['data'][1] > 0) {
      postSlack('You still have dollars.')
    } else if (memberData['data'][1] <= 0 && !memberData['data'][3]) {
      postSlack('You are back. I hope you hit next.')
      setValue(sheet, e.parameter.user_name, 1000, 2)
      setValue(sheet, e.parameter.user_name, 1, 4)
    } else {
      postSlack('Cannot be reviced twice.')
    }
  }
}

function showHitList(table) {
  var text = ''

  for (var key in table) {
    text += (key + ' × ' + ODDS_TABLE[key]) + '\n'
  }

  return text
}

function outputTextArray(dataArray) {
  var text = ''

  for(var i = 0; i < dataArray.length; i++){
    text += dataArray[i] + '\n'
  }

  return text
}

function outputBigText(dataArray) {
  var text = ''

  for(var r = 0; r < dataArray.length; r++){
    for(var c = 0; c < dataArray[r].length; c++){
      text += dataArray[r][c] + ' '
    }
    text += '\n'
  }

  return text
}

function outputText(dataArray) {
  var text = ''

  for(var i = 0; i < dataArray.length; i++){
    text += dataArray[i] + ' '
  }

  return text
}

function createResultParts() {
  var slotParts = SLOT_PARTS
  var resultParts = []

  for(var i = 0; i < 3; i++){
    resultParts.push(slotParts[Math.floor(slotParts.length * Math.random())])
  }

  return resultParts
}

function createBigResultParts() {
  var slotParts = BIG_SLOT_PARTS
  var resultParts = []

  for(var r = 0; r < 3 ; r++) {
    var rowParts = []
    for(var i = 0; i < 5 ; i++) {
      rowParts.push(slotParts[Math.floor(slotParts.length * Math.random())])
    }
    resultParts.push(rowParts)
  }

  return resultParts
}

function isHit(resultParts) {
  //左上の位置を左から右へずらして3*3マスを判定
  for(var sp = 0; sp < 3; sp++) {
    //ヨコ
    for(var r = 0; r < 3; r++) {
      if (resultParts[r][0 + sp] === resultParts[r][1 + sp] && resultParts[r][1 + sp] === resultParts[r][2 + sp]){
        return ODDS_TABLE[resultParts[r][0 + sp]]
      }
    }

    //ナナメ
    if (resultParts[0][0 + sp] === resultParts[1][1 + sp] && resultParts[1][1 + sp] === resultParts[2][2 + sp]) {
      return ODDS_TABLE[resultParts[r][0 + sp]]
    }
    if (resultParts[2][0 + sp] === resultParts[1][1 + sp] && resultParts[1][1 + sp] === resultParts[0][2 + sp]) {
      return ODDS_TABLE[resultParts[2][0 + sp]]
    }
  }
  return false
}

function readSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet()
  var sheet = ss.getSheetByName(TARGET_SHEET)

  return sheet
}

function findRow(sheet,val,col){
  var dat = sheet.getDataRange().getValues() //受け取ったシートのデータを二次元配列に取得

  for(var i=1;i<dat.length;i++){
    if(dat[i][col-1] === val){
      return { index: i+1, data:dat[i] }
    }
  }
  return false
}

// 行の存在に応じて追加もしくは更新を行う
//function insertUpdateMember(sheet, member, val, col) {
//  var row = findRow(sheet, member, col);
//  if (row) { // 行が見つかったら更新
//    sheet.getRange(row, 2, 1, 1).setValues([[val]]);
//  } else { // 行が見つからなかったら新しくデータを挿入
//    sheet.appendRow([member, '0']);
//  }
//}

// 行の存在に応じて追加もしくは更新を行う
function insertUpdateMember(sheet, member, val, col) {
  var point = 1000

  var row = findRow(sheet, member, col);

  if (row) { // 行が見つかったら更新
    point = sheet.getRange(row, 2).getValue()
    point += val
    sheet.getRange(row, 2, 1, 1).setValues([[point]]);
  } else { // 行が見つからなかったら新しくデータを挿入
    point = FIRST_MONEY
    sheet.appendRow([member, point]);
  }

  return point
}

function insert(sheet, member) {
  var balance = FIRST_MONEY
  sheet.appendRow([member, balance, 0])

  return balance
}

function update(sheet, member, val, notDecrease) {
  var row = findRow(sheet, member, 1)['index'];
  val = parseInt(parseInt(val, 10))

  var balance = sheet.getRange(row, 2).getValue()
  if (notDecrease === undefined) {
    balance -= val
    balance = Math.floor(balance)
  }
  sheet.getRange(row, 2, 1, 2).setValues([[balance, val]]);

  return balance
}

function setValue(sheet, member, val, col) {
  var row = findRow(sheet, member, 1)['index'];
  val = parseInt(parseInt(val, 10))

  sheet.getRange(row, col, 1, 1).setValues([[val]]);
}

function test(){
  //postSlack("これはテストです")
  e = { parameter: { text: 'スロット大オッズ' } }

  var result = selectFunction(e)

  //Logger.log(result)
  //Logger.log(isHit(result))
}


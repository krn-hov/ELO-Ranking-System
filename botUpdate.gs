var token = "";     // 1. FILL IN YOUR OWN TOKEN
var telegramUrl = "https://api.telegram.org/bot" + token;
var webAppUrl = ""; // 2. FILL IN YOUR GOOGLE WEB APP ADDRESS
var ssId = "";      // 3. FILL IN THE ID OF YOUR SPREADSHEET

function getMe() {
  var response = UrlFetchApp.fetch(telegramUrl + "/getme");
  contents = JSON.parse(response)
  Logger.log(contents)
}

function setWebhook() {
  var response = UrlFetchApp.fetch(telegramUrl + "/setWebhook?url=" + webAppUrl);
  contents = JSON.parse(response);
  Logger.log(contents);
}

function doGet(e) {
  return HtmlService.createHtmlOutput("Hello" + JSON.stringify(e));
}

function checkStringForNumbers(inputString) {
  return /^\d+$/.test(inputString);
}

function isAlphaNumeric(str) {
  var code, i, len;

  for (i = 0, len = str.length; i < len; i++) {
    code = str.charCodeAt(i);
    if (!(code > 47 && code < 58) && // numeric (0-9)
        !(code > 64 && code < 91) && // upper alpha (A-Z)
        !(code > 96 && code < 123)) { // lower alpha (a-z)
      return false;
    }
  }
  return true;
}

function modifyFirstEmptyCell(sheetName,column,newValue,bold=false) {
  var sheet = SpreadsheetApp.openById(ssId).getSheetByName(sheetName);
  var col = column; // Replace with the column number you want to search for an empty cell (e.g., 1 for column A)
  var values = sheet.getRange(1, col, sheet.getLastRow()).getValues(); // Get all values in the specified column
  
  for (var i = 0; i < values.length; i++) {
    if (values[i][0] === "") { // If the cell is empty
      var cell = sheet.getRange(i+1, col); // Get the range for the first empty cell
      if(bold){cell.setValue(newValue).setFontWeight('bold')} // Replace "New Value" with the new value you want to set for the cell
      else {cell.setValue(newValue)}
      break; // Exit the loop after modifying the first empty cell
    }
  }
}

function inColumn(sheetName,column,value) {
  var sheet = SpreadsheetApp.openById(ssId).getSheetByName(sheetName);
  var values = sheet.getRange(2,column,sheet.getLastRow()).getValues();
  var valuesFlat = values.map(function(row) {return row[0];}); //flattening values since they come like [[a],[b]]
  if (valuesFlat.indexOf(value) != -1) {
    // it's there 
    return true;
  }
  else {
    // it's not there
    return false;
  }
}

function sortRankings(id) { // sorts rankings by ELO with games played as tie breaker
  var sheet = SpreadsheetApp.openById(ssId).getSheetByName("Ranking");
  var range = sheet.getRange(2,2,sheet.getLastRow(),3);
  range.sort([{column: 3, ascending: false}, {column: 4, ascending: false}, {column: 2, ascending: true}]);
}

function getColumnValues(column, data) {
  var columnIndex = column - 1;
  var columnValues = data.map(function(row) {
    return row[columnIndex];
  });
  return columnValues;
}

function getPlayerRow(player) { //get row of player in ranking sheet
  var sheet = SpreadsheetApp.openById(ssId).getSheetByName("Ranking");
  var data = sheet.getDataRange().getValues();
  var columnValues = getColumnValues(2, data);
  var rowIndex = columnValues.indexOf(player);
  return rowIndex + 1;
}

function updateScore(text,id) {
  if(text.length != 2) {
    sendText(id,"invalid format, probably because of spaces");
  }
  var content = text[1].split(";");
  if(content.length != 3) {
    sendText(id,"invalid input format");
    return;
  }

  var p1 = content[0];
  var p2 = content[1];
  var score = content[2];

  if (!inColumn("Ranking",2,p1)) {
      sendText(id,"name is not registered");
      return;
    }
  if (!inColumn("Ranking",2,p2)) {
      sendText(id,"name is not registered");
      return;
    }

  var p1result;
  var p2result;
  if (score == 1) {p1result = 1; p2result = 0}
  else if (score == 2) {p1result = 0; p2result = 1}
  else {sendText(id,"invalid score"); return;}

  var sheet = SpreadsheetApp.openById(ssId).getSheetByName("Scores");

  var lastRowInt = sheet.getLastRow();

  // fill in scores,player names,old rankings. make 2 lines for each player
  var now = new Date();
  var sheet2 = SpreadsheetApp.openById(ssId).getSheetByName("Ranking");
  var p1row = getPlayerRow(p1); var p2row = getPlayerRow(p2);
  var p1oldscore = sheet2.getRange(p1row,3).getValue(); var p2oldscore = sheet2.getRange(p2row,3).getValue();
  sheet.getRange(lastRowInt+1,1,1,6).setValues([[now,p1,p2,p1result,p1oldscore,p2oldscore]]);
  sheet.getRange(lastRowInt+2,1,1,6).setValues([[now,p2,p1,p2result,p2oldscore,p1oldscore]]);

  // drag down formulas from previous row
  var sourceRange = sheet.getRange(lastRowInt,7,1,3);
  sourceRange.autoFill(sheet.getRange(lastRowInt,7,2,3),SpreadsheetApp.AutoFillSeries.DEFAULT_SERIES);
  var sourceRange = sheet.getRange(lastRowInt+1,7,1,3);
  sourceRange.autoFill(sheet.getRange(lastRowInt+1,7,2,3),SpreadsheetApp.AutoFillSeries.DEFAULT_SERIES);

  var p1newscore = sheet.getRange(lastRowInt+1,9).getValue();
  var p2newscore = sheet.getRange(lastRowInt+2,9).getValue();

  // lookup players in ranking sheet and update the ranking
  //update games played
  var p1gp = sheet2.getRange(p1row,4).getValue(); var p2gp = sheet2.getRange(p2row,4).getValue(); 
  sheet2.getRange(p1row,3,1,2).setValues([[p1newscore,p1gp+1]]); 
  sheet2.getRange(p2row,3,1,2).setValues([[p2newscore,p2gp+1]]);
  
  // sort rankings sheet and sort scores sheet by date
  sortRankings();
  var scoreRange = sheet.getRange(3,1,sheet.getLastRow(),9)
  scoreRange.sort({column:1,ascending:false});
  sendText(id,"rankings updated");
}

function newPlayer(text,id) {
  if(text.length != 2) {
    sendText(id,"invalid format, probably because of spaces");
    return;}
  content = String(text[1]);
  if (checkStringForNumbers(content)) {sendText(id,"name must contain letters"); return;}
  if (isAlphaNumeric(content)) {
    if (inColumn("Ranking",2,String(content))) {
      sendText(id,"name is already taken");
      return;
    }
    var sheet = SpreadsheetApp.openById(ssId).getSheetByName("Ranking");
    var lastRow = sheet.getLastRow();
    var newRow = sheet.getRange(lastRow+1,1,1,4);
    newRow.setValues([[lastRow,String(content),1000,0]]);
    sortRankings(id);
    sendText(id,"registered");
  } else {
    sendText(id,"not alphanumeric");
  }
  
}

function sendRanking(id) {
  sendText(id,"https://docs.google.com/spreadsheets/d/18l3TJHxUcPHRTVltrNQCGfWNDjH3D300DdvleA6rCXY/edit?usp=sharing");
}

function sendText(id,text) {
  var url = telegramUrl + "/sendMessage?chat_id=" + id + "&text=" + encodeURIComponent(text);
  var response = UrlFetchApp.fetch(url);
  Logger.log(response.getContentText());
}

function doPost(e) {
  content = JSON.parse(e.postData.contents);
  var id = content.message.from.id;
  var text = content.message.text;

  if (content.message.hasOwnProperty("entities")) {
    var command_truth = content.message.entities[0].type;
    var txt = text.split(" ")
    if (txt[0] == "/score") {
      updateScore(txt,id);
      return;
    } else if (txt[0] == "/newp") {
      newPlayer(txt,id);
      return;     
    } else if (txt[0] == "/rank") {
      sendRanking(id);
      return;
    } else {
      sendText(id,"command not recognized, try adding a space after the command")
    }
  } else {
    sendText(id,"not a command")
  }
}
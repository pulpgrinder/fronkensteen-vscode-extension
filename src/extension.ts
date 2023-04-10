import * as vscode from 'vscode';
import axios from 'axios';
import * as WebSocket from 'ws';
import { sha3_512 } from 'js-sha3';
let serverUrl: string | null | undefined  = null;
let passphrase: string | null | undefined = null;

async function requestServerUrl(): Promise<string | undefined> {
	return await vscode.window.showInputBox({
	  prompt: 'Please enter the server URL',
	  value:"localhost:5901",
	  ignoreFocusOut: true
	});
  }

  async function requestPassphrase(): Promise<string | undefined> {
	return await vscode.window.showInputBox({
	  prompt: 'Please enter the passphrase',
	  password: true,
	  ignoreFocusOut: true
	});
  }
async function connectWebSocket(host: string): Promise<WebSocket> {
	return new Promise((resolve, reject) => {
	  const ws = new WebSocket(host);
  
	  ws.on('open', () => {
		resolve(ws);
	  });
  
	  ws.on('error', (error: any) => {
	    serverUrl = null;
		passphrase = null;
		reject(error);
	  });
	});
  }

function displayResult(result: string){
	const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }
	let commentedresult = " ; " + result;
	insertAndSelectMultilineText(commentedresult);
}


async function insertAndSelectMultilineText(text: string): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
	  return;
	}
  
	const startPosition = editor.selection.end;
	const endPosition = calculateEndPosition(startPosition, text);
  
	const success = await editor.edit((editBuilder) => {
	  editBuilder.insert(startPosition, text);
	});
  
	if (success) {
	  editor.selection = new vscode.Selection(startPosition, endPosition);
	} else {
	  vscode.window.showErrorMessage('Failed to insert text at the cursor position.');
	}
  }
  
  function calculateEndPosition(startPosition: vscode.Position, text: string): vscode.Position {
	const lines = text.split('\n');
	const lineDelta = lines.length - 1;
	const characterDelta = lineDelta === 0 ? lines[0].length : lines[lines.length - 1].length;
  
	return startPosition.translate(lineDelta, characterDelta);
  }

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand('extension.schemeExpressionEvaluator', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }
    const { document, selection } = editor;
    const selectedText = document.getText(selection);
    const expression = selectedText || findPrecedingSExpression(document, selection.start);

    if (expression) {
      const result = await postExpressionToServer(expression);
      if (result) {
		displayResult(result);
      }
    }
  });
  context.subscriptions.push(disposable);
}

function findPrecedingSExpression(document: vscode.TextDocument, position: vscode.Position): string {
	let parencounter = 0;
	let bracketcounter = 0;
	const textBeforePosition = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
	//const reversedText = textBeforePosition.split('').reverse().join('');
	let lastChar = textBeforePosition[textBeforePosition.length - 1];
	if(( lastChar === ')') || (lastChar ===  '"') ) {
	  return parseStringOrSExpression(textBeforePosition);
	}
	else if((lastChar === ' ') || (lastChar === '\t') || (lastChar === '\n')){
	  displayResult('Please select some code, or place the cursor at the end of an atom, string, or pair.');
	  return "";
	}
	else {
	  return parseAtom(textBeforePosition);
	}
	
  }

function parseAtom(precedingText:string){
	let counter = precedingText.length - 1;
	let currentChar = precedingText[counter];
	while(counter >= 0 && currentChar !== ' ' && currentChar !== '\n' && currentChar !== '\t' && currentChar !== '(' && currentChar !== ')'){
		counter = counter - 1;
		currentChar = precedingText[counter];
	}
	return precedingText.substring(counter+1,precedingText.length);
} 
function parseStringOrSExpression(precedingText:string){
	let offset;
	let balancecheck:any = [];
	let candidate;
	for(offset = precedingText.length - 1; offset >= 0; offset--){
	  candidate =  precedingText.substring(offset,precedingText.length);
	  balancecheck = balanced(candidate);
	  if(balancecheck === true){
		return candidate;
	  }
	}
	if(offset < 0){
	  displayResult("No balanced expression found preceding cursor.");
	  return "";
	}
  	else {
		if(balancecheck.length === 0){
	  	 displayResult(" Missing " + balancecheck.join(""));
		 return "";
	}
	else {
	  displayResult("Unparseable.");
	  return "";
	}
  }
}

function balanced(str:string){
	let result = balanced2(str,[]);
	if(result === true){
 	 return true;
	}
	return result;
}

function balanced2(str:string,expect:string[]){
let stringtype = "";
let lastchar = null;
for(let i = 0; i < str.length; i++){
  let currentchar = str.charAt(i);
  if(lastchar === "\\"){ // Escaped char
	lastchar = null;
	continue;
  }
  if(currentchar === "\\"){
	lastchar = "\\";
	continue;
  }
  if(currentchar === '"'){
	if(stringtype === '"'){ // End of string
	  stringtype = "";
	  lastchar = null;
	  continue;
	}
	else{
	  stringtype = currentchar;
	  lastchar = null;
	  continue;
	}
  }
  if(stringtype !== ""){ // In a string.
	lastchar = null;
	continue;
  }
  lastchar = currentchar;
  switch(currentchar){
	case '(': expect.push(')');
	continue;
	case '[': expect.push(']');
	continue;
	case '{': expect.push('}');
	continue;
	case ')':
	case ']':
	case '}': if((expect.length > 0) && (expect.pop() === currentchar)){
	  continue;
	}
	else {
	  switch(currentchar){
		case ')': return ['('];
		case ']': return ['['];
		case '}': return ['{'];
	  }
	}
	default: continue;
  }
}
	if((expect.length === 0) && (stringtype === "")){
  	return true;
	}
	return expect;
}
async function postExpressionToServer(expression: string): Promise<string | null> {
	while (true) {
	  if (serverUrl === null) {
		serverUrl = await requestServerUrl();
		if (serverUrl === undefined) {
		  // The user canceled the server URL input
		  return null;
		}
	  }
  
	  if (passphrase === null) {
		passphrase = await requestPassphrase();
		if (passphrase === undefined) {
		  // The user canceled the passphrase input
		  return null;
		}
	  }
  
	  try {
		if(serverUrl === undefined){
			return null;
		}
		const ws = await connectWebSocket(`ws://${serverUrl}`);
  
		const signature = sha3_512(expression + passphrase);
		ws.send(
		  JSON.stringify({
			"expr": expression,
			"signature":signature
		  })
		);
  
		return await new Promise<string | null>((resolve, reject) => {
		  ws.on('message', (message: { toString: () => string; }) => {
			const response = JSON.parse(message.toString());
			if (response.status !== 'OK') {
			  // Reset passphrase and try again
			  passphrase = null;
			  serverUrl = null;
			  resolve(response.status);
			} else {
			  const expectedSignature = sha3_512(response.result + passphrase);
  
			  if (response.signature === expectedSignature) {
				resolve(response.result);
			  } else {
				resolve('Invalid signature in server response');
			  }
			}
			ws.close();
		  });
  
		  ws.on('error', (error: any) => {
			displayResult('Error during WebSocket communication:' + error);
			passphrase = null;
			serverUrl = null;
			reject(null);
			ws.close();
		  });
		});
	  } catch (error) {
		displayResult('Error connecting to WebSocket server:' + error);
		passphrase = null;
		serverUrl = null;
		return null;
	  }
	}
  }
  
export function deactivate() {}

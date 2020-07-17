// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { DataProvider } from './dataProvider';
import { Subsystem, Command } from './treeType';
import * as Loader from './loader';
import * as fs from 'fs';
import { Console } from 'console';

let providers:DataProvider[] = [];

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "ler-botbuilder" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('ler-botbuilder.refresh', () => {
		refresh();
	});
	Loader.load(vscode.workspace.rootPath || "").then(()=>{
		console.log("Registering");
		let d = new DataProvider(getSubsystems);
		providers.push(d);
		vscode.window.registerTreeDataProvider('subsystems', d);
		d = new DataProvider(getCommands);
		providers.push(d);
		vscode.window.registerTreeDataProvider('commands', d);
	});

	fs.watch(vscode.workspace.rootPath +"/build/classes", {persistent:false, recursive:true}, (event, filename)=>{
		console.log(event+":"+filename);
		refresh(1000);
	});

	context.subscriptions.push(disposable);
}



// this method is called when your extension is deactivated
export function deactivate() {}


// Timer optionally used by refresh to prevent multiple calls
var refreshTimer:NodeJS.Timeout = null;
/**
 * Refresh the treeview.
 * @param timeout A timeout with this duration will be created, if another call to refresh() is made before the timeout occurs, the refresh will be cancelled in favour of the newer one
 */
function refresh(timeout = 0){
	// Clear existing timer
	if(refreshTimer !== null){
		clearTimeout(refreshTimer);
	}

	refreshTimer = setTimeout(() => {
		console.log("Refreshing");
		Loader.load(vscode.workspace.rootPath).then(()=>{
			for(let p of providers){
				p.refresh();
			}
		});
	}, timeout);
}

function getSubsystems(): Subsystem[]{
	return Loader.subsystems;
}

function getCommands(): Command[]{
	return Loader.commands;
}
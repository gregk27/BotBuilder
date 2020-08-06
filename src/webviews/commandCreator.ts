import { WebviewBase } from "./webView";
import * as vscode from 'vscode';
import { ParameterItem } from "resources/html/scripts/parameterSelector";
import { getSubsystems } from "../extension";
import { webview } from "../../resources/html/scripts/common";
import { ClassBuilder } from "../classBuilder/classBuilder";
import { getClassDetail } from "../javaParser/parserFunctions";
import { Scope } from "../javaParser/common";
import { InnerClassesAttributeInfo } from "java-class-tools";
import { Linkable } from "src/treeView/codeElements";

export class CommandCreator extends WebviewBase {
    
    constructor(context:vscode.ExtensionContext, private basepath:string){
        super(context, "newCommand", "New Command", "commandCreator.html");
    }

    public getHTML():string{
        let subsystems:ParameterItem.TypeData = {
        };
        for(let subsystem of getSubsystems()){
            let group = subsystem.element.pckg.replace("ler/robot/subsystems", "");
            if(!(group in subsystems)){
                subsystems[group] = [];
            }
            subsystems[group].push({
                descriptor:subsystem.element.descriptor,
                name:subsystem.element.name
            });
        }

        return this.html
            .replace(/\${PACKAGE}/g, "ler.robot.commands")
            .replace(/\${PACKAGE_AUTO}/g, "ler.robot.commands.autonomous")
            .replace(/\${PACKAGE_INSTANT}/g, "ler.robot.commands.instant")
            .replace(/\${PACKAGE_AUTO_INSTANT}/g, "ler.robot.commands.autonomous")
            .replace(/\${SUBSYSTEMS}/g, JSON.stringify(subsystems));
    }

    onMessage(message:webview.Message, panel:vscode.WebviewPanel):void {
        if(message.id === "submit"){
            let file = this.buildClass(message.payload);
            panel.dispose();
            vscode.commands.executeCommand("ler-botbuilder.openFile", <Linkable>{
                getTarget(){
                    return{
                        file,
                        line:-1
                    };
                }
            });
        }
    }

    buildClass(payload: {[key:string]: webview.InputState}):string{
        let fields:ClassBuilder.Field[] = [];
        let constructorParams:ClassBuilder.MethodParam[] = [];
        let constructorBody = "";
        let assignments = "";

        for(let h of payload["hardware"].data){
            let t = getClassDetail(h.type);
            fields.push(new ClassBuilder.Field({import:t.full, type:t.name, isArray:false}, h.name, Scope.DEFAULT, h.doc));
            constructorParams.push({import:t.full, type:t.name, name:h.name, doc:h.doc, isArray:false});
            if(h.required){
                constructorBody = `addRequirements(${h.name});\n`;
            }
            assignments += `this.${h.name} = ${h.name};\n`;
        }

        constructorBody += "\n"+assignments.trim();

        let methods: ClassBuilder.Method[] = [];
        methods.push(new ClassBuilder.Method(null, null, constructorParams, Scope.PUBLIC, `Create a new ${payload["package"].data}.\n`, false, false, constructorBody));

        // Create overridden methods
        methods.push(new ClassBuilder.Method(null, "initialize", [], Scope.PUBLIC, "Called when the command is initially scheduled.<br/>\nMay be triggered by a button/command group or as a default command", false, false, "//TODO: Initialize subsystems\n", ["Override"]));
        methods.push(new ClassBuilder.Method(null, "execute", [], Scope.PUBLIC, "Called once every 20ms (nominally)", false, false, null, ["Override"]));
        methods.push(new ClassBuilder.Method(null, "end", [{doc:"Flag indicating if the command was interrupted", import:null, isArray:false, name:"interrupted", type:"string"}], Scope.PUBLIC, "Called when the command ends", false, false, "//TODO: Initialize subsystems\n", ["Override"]));
        methods.push(new ClassBuilder.Method({import:null, isArray:false, type:"boolean"}, "isFinished", [], Scope.PUBLIC, "Called to check command status, command will end if this returns true.", false, false, "//TODO: Auto generated method stub\nreturn false;", ["Override"]));

        let builder = new ClassBuilder(payload["package"].data, payload["name"].data, Scope.PUBLIC, {import:"edu.wpi.first.wpilibj2.command.CommandBase", type:"CommandBase"}, [], fields, methods, payload["doc"].data);
        console.log(builder.getCode());
        return builder.writeFile(this.basepath);
    }

}
import { CodeAttributeInfo, ConstantValueAttributeInfo, FieldInfo, LineNumberTableAttributeInfo, LocalVariableTableAttributeInfo, MethodInfo, Modifier } from "java-class-tools";
import { ClassDetail, DescriptorTypes, JavaBase, MethodParam, Scope, Type } from "./common";
import { JavaClass } from "./JavaClasses";
import { getClassDetail, getScope, getStringFromPool, getValueFromPool, parseAttributes } from "./parserFunctions";

/**
 * Base class used to represet an element of a {@link JavaClass}
 */
export abstract class JavaElement extends JavaBase{
    /**
     * The index of the {@link JavaBase#name | name} in the constant pool
     */
    public readonly nameIndex: number;
    /**
     * The index of the {@link JavaBase#descriptor | descriptor} in the constant pool
     */
    public readonly descriptorIndex: number;
    
    /**
     * The {@link JavaBase#descriptor | descriptor} of the {@link JavaClass} containing the element
     */
    public readonly parentClass: ClassDetail;
    
    /**
     * Flag indicating if the element is static
     */
    public readonly isStatic: boolean;

    /**
     * Create a new JavaElement from a {@link JavaClass | parent class} and a relevant info type (either field or method)
     * @param parent The {@link JavaClass} containing the element 
     * @param element The compiled representation of the element
     */
    constructor(parent:JavaClass, element: FieldInfo | MethodInfo){
        let file = parent.classFile;
        super(getStringFromPool(file, element.name_index), getStringFromPool(parent.classFile, 
            element.descriptor_index), getScope(element.access_flags), ((element.access_flags & Modifier.FINAL) === Modifier.FINAL));
        
        this.nameIndex = element.name_index;
        this.descriptorIndex = element.descriptor_index;
        
        this.parentClass = getClassDetail(parent.descriptor);
        this.isStatic = ((element.access_flags & Modifier.STATIC) === Modifier.STATIC);
    }

    /**
     * Check if this is equal to another JavaElement by checking the parentClass, name, and descriptor
     * @param e Another {@link JavaElement} to compare against
     */
    public equals(e:JavaElement): boolean{
        return e.parentClass === this.parentClass
            && e.name === this.name
            && e.descriptor === this.descriptor;
    }

    /**
     * Get a string representation of the element
     */
    public toString(): string{
        return this.parentClass.full.replace(/\//g, ".")+"."+this.name+this.descriptor;
    }

    /**
     *  Internal function used to get the pretty name.
     *  This is used by prettyName(boolean), and is appended to the class name as required
     */
    public abstract getPrettyName(): string;

    /**
     * Get an extended version of the pretty-print name 
     * @param includeClass Flag to indicate wether the parent class should be added to the start
     */
    public getFullPrettyName(includeClass:boolean): string{
        return this.getModifiers(includeClass)+this.getPrettyName();
    };

    /**
     * Internal method used to get the modifiers (final/public/abstract/etc)
     * @param includeClass If true, the parent class will be added to the start
     */
    protected getModifiers(includeClass:boolean): string {
        let out = includeClass ? this.parentClass.full.replace(/\//g, ".")+"/" : ""; 
        if(this.scope !== Scope.DEFAULT){out += this.scope+" ";}
        if(this.isStatic){out += "static ";}
        if(this.isFinal){out += "final ";}
        return out;
    }

    /**
     * Check if this is equal to another element by comparing the signatures
     * @param signature The signature of the other element to compare against
     */
    public is(signature:string): boolean{
        return this.parentClass+this.name+this.descriptor === signature;
    }
}

/**
 * Class to represent a field in a {@link JavaClass}
 */
export class JavaField extends JavaElement{
    
    /**
     * The {@link Type} of the field
     */
    public readonly type: Type;
    /**
     * The constant value of this field
     * @remark This value will be `null` if the field is not constant, non-primitive (except Strings), or an array
     */
    public constVal: any;

    /**
     * Create a new JavaField from a {@link JavaClass | parent class} and field info
     * @param parent The {@link JavaClass} containing the field 
     * @param element The compiled representation of the field
     */
    constructor(parent: JavaClass, field:FieldInfo){
        super(parent, field);
        this.type = new Type(this.descriptor);
        
        this.constVal = null;
        parseAttributes(parent.classFile, field.attributes, 
            {
                "ConstantValue": (attr) => 
                    this.constVal = getValueFromPool(parent.classFile, (<ConstantValueAttributeInfo> attr).constantvalue_index),
            }
        );
    }

    public getPrettyName(): string{
        let out = this.type.pretty+" ";
        out += this.name;
        if(this.isFinal){
            out+= "="+this.constVal;
        }
        return out;
    }
}

/**
 * Class used to represent a method in a {@link JavaClass}
 */
export class JavaMethod extends JavaElement{       
    
    /**
     * Flag indicating wether the function is abstract
     */
    public readonly isAbstract: boolean;
    
    /**
     * Pretty-print version of the method signature
     */
    private prettySiganture: string;
    /**
     * Array conaning the method parameters, stored in {@link MethodParam}s
     */
    public params: MethodParam[];
    /**
     * The return {@link Type} of the function
     */
    public readonly returnType: Type;

    /**
     * The line number the function starts on in the source code
     * @remark If the `LineNumberTable` is not stored in the compiled code, this value will be `-1`
     */
    public readonly startLine: number = -1;
    
    /**
     * Create a new JavaMethod from a {@link JavaClass | parent class} and method info
     * @param parent The {@link JavaClass} containing the method 
     * @param element The compiled representation of the method
     */
    constructor(parent:JavaClass, method:MethodInfo){
        super(parent, method);
        // Get the return type from the end of the descriptor
        this.returnType = new Type(this.descriptor.substr(this.descriptor.lastIndexOf(")")+1));
        let startLine = -1;
    
        // Parse parameter types, parameter values comes from code attributes
        let idxMap = this.getParams();
        
        // Create pretty readable signature
        let prettySignature = this.name+"(";
        for(let param of this.params){
            prettySignature+=param.type.pretty+", ";
        }
        if(prettySignature.endsWith(", ")){
            prettySignature = prettySignature.substring(0,prettySignature.length-2);
        }
        prettySignature+= ")";
        if(this.returnType.type !== DescriptorTypes.VOID){
            prettySignature += "=>"+this.returnType.pretty;
        }
    
        // Get information from various attributes
        parseAttributes(parent.classFile, method.attributes, {
            "Code": (attr)=>{
                parseAttributes(parent.classFile, (<CodeAttributeInfo> attr).attributes, {
                    "LineNumberTable": (codeAttr)=>{
                        // The first element in the index is the first instruction, so line before is method declaration
                        startLine = (<LineNumberTableAttributeInfo> codeAttr).line_number_table[0].line_number-1;
                    },
                    "LocalVariableTable": (codeAttr)=>{
                        // Parse local variable table to get method parameters
                        for(let v of (<LocalVariableTableAttributeInfo> codeAttr).local_variable_table){
                            let vName = getStringFromPool(parent.classFile, v.name_index);
                            // Ignore "this" or any variables declared during the function (pc > 0)
                            if(vName === "this" || v.start_pc !== 0){
                                continue;
                            }
                            let idx = v.index;
                            // Non-static methods have a "this" argument, so index must be bumped down for params to start at 0 
                            if((method.access_flags & Modifier.STATIC) !== Modifier.STATIC){
                                idx --;
                            }
                            this.params[idxMap.get(idx)].name = vName;
                        }
                    }
                });
            },
        });

    }

    /**
     * Local function used in construction to parse the arguments from the method signature
     * 
     * @returns A map linking positions in {@link JavaMethod#args | this.args} to indicies in the `LocalVariableTable` for later use
     */
    private getParams(): Map<number, number>{        
        this.params = [];

        // Mapping to track index of parameters for matching with names
        let idxMap = new Map<number, number>();
        let nextIdx = 0;

        // Get the parameters from the descriptor
        let paramString = this.descriptor.substring(1, this.descriptor.lastIndexOf(")"));
        
        // Variable to track array values
        let currentArrayStart = -1;
        for(let i = 0; i<paramString.length; i++){
            let param = <MethodParam>{name:"", type:null};
            if(paramString[i] === "["){ // Track start of array
                if(currentArrayStart === -1){ 
                    currentArrayStart = i;
                }
                continue;
            } else if (currentArrayStart >= 0){ // If this trips, then we've hit the end of the array count
                if (paramString[i] === "L"){
                    param.type = new Type(paramString.substring(currentArrayStart, paramString.indexOf(";", i)+1));
                    i = paramString.indexOf(";", i);
                } else {
                    param.type = new Type(paramString.substring(currentArrayStart, i+1));
                }
                currentArrayStart = -1;
            } else if (paramString[i] === "L"){
                param.type = new Type(paramString.substring(i, paramString.indexOf(";", i)+1));
                i = paramString.indexOf(";", i);
            } else {
                param.type = new Type(paramString[i]);
            }
    
    
            idxMap.set(nextIdx, this.params.length);
            // Longs/doubles take two spaces, so increment index by 2
            if(param.type.type === DescriptorTypes.LONG || param.type.type === DescriptorTypes.DOUBLE){
                nextIdx += 2;
            } else {
                nextIdx ++;
            }
            this.params.push(param);
        }

        return idxMap;
    }

    public getPrettyName(): string{
        return this.prettySiganture;
    }
}
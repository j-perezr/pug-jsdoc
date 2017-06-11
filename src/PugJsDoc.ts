import * as map from "map-stream";
import * as vfs from "vinyl-fs";
import * as extend from "extend";
//find files
//for each file
    //search comments in the content with @pugdoc
    //parse the comment to js comment
    //append the comment to a virtual file
    //invoke the method
export interface IPugJsDocOptions{
    src:string[]|string;
    output?:"string";
    exclude?:string[]|string;
    jsDocOptions?:any;
}
export interface IProcessFileResult{
    blocks:IPugDocBlock[],
    raw:string;
}
export interface IPugDocBlock{
    start:number;
    end:number;
    lines:string[];
    raw:string;
}
export interface IPugFile{
    basename:string;
    base:string;
    path:string;
    blocks:IPugDocBlock[];
    raw:string;
}
export interface IPugJsDocRuntime{
    files:IPugFile[],
    raw:string;
}
export class PugJsDoc{
    protected static readonly DEFAULTS:IPugJsDocOptions = {
        src:"**/*.pug",
        exclude:[
            "node_modules/**/*",
            "bower_components/**/*",
            "jspm_packages/**/*"
        ]
    };
    protected _map = map;
    protected _vfs = vfs;
    protected _extend = extend;
    protected _parsed:IPugJsDocRuntime;
    protected _options:IPugJsDocOptions;
    constructor(options:IPugJsDocOptions=<any>{}){
        this._options = this._extend(true,{},PugJsDoc.DEFAULTS,this._options);
    }
    renderAsync(){
        this._parsed = {
            files:[],
            raw:""
        };
    }
    explainAsync(){
        this._parsed = {
            files:[],
            raw:""
        };
        debugger;
        this._start(this._resolveSrc(this._options.src,<any>this._options.exclude));
    }
    /**
     * @description Resolve the valid src option.
     * @returns the glob to execute by vinyl-fs
     */
    protected _resolveSrc(src,exclude=""){
        let internalSrc = src,
            internalExclude:string|string[] = exclude;
        if(!Array.isArray(internalSrc)){
            internalSrc = [internalSrc];
        }
        if(!Array.isArray(internalExclude)){
            internalExclude = [internalExclude];
        }
        for (let excludeIndex = 0, internalExcludeLength = internalExclude.length; excludeIndex < internalExcludeLength; excludeIndex++) {
            let current = internalExclude[excludeIndex];
            internalExclude[excludeIndex] = "!"+current;
        }
        return (<string[]>internalExclude).concat(internalSrc);
    }
    /**
     * Start the process
     */
    protected _start(src){
        this._vfs.src(src)
            .pipe(this._map(this._onReadFile.bind(this)))
            .on("error",this._onProcessFileError.bind(this))
            .on("end",this._onEnd.bind(this))
    }
    protected _onEnd(){
    }
    protected _onProcessFileError(e){
        console.error(e.message);
    }
    /**
     * @description Invoked for each file founded. Process the content searching for valid documentation blocks.
     */
    protected _onReadFile(file,cb){
        //process the file
        let result:IProcessFileResult = this._processFile(file);
        //if some block has been found
        if(result.blocks.length > 0) {
            let pugFile:IPugFile = {
                basename: file.basename,
                base: file.base,
                path: file.path,
                blocks: result.blocks,
                raw:result.raw
            };
            this._parsed.files.push(pugFile);
            //content to pass to jsdoc
            this._parsed.raw+=pugFile.raw;
        }
        cb(null, file);
    }
    /**
     * @description Check if the line is a start of documentation block
     * @returns boolean
     */
    protected _isStartOfBlock(line:string):boolean{
        return line.search(/@pugdoc/) !== -1;
    }
    /**
     * @description Process the starting block line removing the @pugdoc tag put preserving any other tag
     * @returns Line parsed
     */
    protected _processStartBlock(line:string):string{
        let parsedLine = line.replace(/(\/\/-?\s*|@pugdoc\s*)/g, "");
        return parsedLine;
    }
    /**
     * @description Check if the line is a end of documentation block
     * @returns boolean
     */
    protected _isEndOfBlock(line:string):boolean{
        return line.search(/@endpugdoc/) !== -1;
    }
    /**
     * @description Process the ending block line removing the @endpugdoc tag put preserving any other tag
     * @returns Line parsed
     */
    protected _processEndOfBlock(line:string):string{
        let parsedLine = line.replace(/(\/\/-?\s*|@endpugdoc\s*)/g, "").trim();
        return parsedLine;
    }
    /**
     * @description Count the spaces and tabs at the beginning of the line
     * @returns number
     */
    protected _countSpacesAtTheBegining(line:string):number{
        let spacesMatch= line.match(/^([\s|\t]+)/),
            spaces = spacesMatch ? spacesMatch.length : 0;
        return spaces;
    }
    /**
     * @description Generate a highlighted error line
     * @returns string
     */
    protected _markErrorLine(lineIndex,lines){
        let msg = lines.concat([]);
        let mark = new Array(lines[lineIndex].length).fill("^").join("");
        msg.splice(lineIndex,0,mark);
        msg = msg.join("\n");
        return msg;
    }
    /**
     * @description Process a file looking for documentation blocks. Throws an error if the block is not well formed.
     * @param   {string}    file        File to process
     * @returns {IProcessFileResult}  The file processed
     */
    protected _processFile(file):IProcessFileResult{
        let result:IProcessFileResult = {
                blocks:[],
                raw:""
            },
            fileContent = file.contents.toString(),
            lines = fileContent.split('\n'),
            currentBlock:IPugDocBlock,
            spaces = 0;
        //for each line
        for (let lineIndex = 0, linesLength = lines.length; lineIndex < linesLength; lineIndex++) {
            let line = lines[lineIndex],
                //trim for a better process
                lineToProcess = line.trim();
            //if the line is not empty
            if (lineToProcess) {
                //check if is the start of a block
                if (this._isStartOfBlock(lineToProcess)) {
                    //if any block is being processed
                    if (!currentBlock) {
                        currentBlock = {
                            start:lineIndex,
                            end:null,
                            lines:[],
                            raw:null
                        };
                        //remove the special tag preserving the rest
                        let parsedLine = this._processStartBlock(line);
                        //start the block
                        if(!!parsedLine) {
                            currentBlock.lines.push(parsedLine);
                        }
                        //count the indentation to control the indentation
                        spaces = this._countSpacesAtTheBegining(line);
                    } else {
                        //if some block is being processed, throw an error
                        let errorHighlight = this._markErrorLine(lineIndex,lines);
                        throw new Error(`Maybe forgot to close a block with @endpugdoc?\n${errorHighlight}\nat ${file.path}:${lineIndex}`);
                    }
                } else if(currentBlock){//if is not a start
                    //check the indentation
                    let currentSpaces = this._countSpacesAtTheBegining(line);
                    if(currentSpaces <= spaces){
                        let errorHighlight = this._markErrorLine(lineIndex,lines);
                        throw new Error(`Maybe forgot to close a block with @endpugdoc?\n${errorHighlight}\nat ${file.path}:${lineIndex}`);
                    }
                    //check if is the end of a block
                    if (this._isEndOfBlock(lineToProcess)) {
                        //remove the special tag preserving the rest
                        let parsedLine = this._processEndOfBlock(lineToProcess);
                        if(!!parsedLine) {
                            currentBlock.lines.push(parsedLine);
                        }
                        currentBlock.end = lineIndex;
                        this._parseToJsComment(currentBlock);
                        //store the block
                        result.blocks.push(currentBlock);
                        result.raw+=currentBlock.raw;
                        //reset the current block
                        currentBlock = null;
                        spaces = 0;
                    } else {
                        //if is not a start or end of a block
                        currentBlock.lines.push(line);
                    }
                }
            }
        }
        return result;
    }
    /**
     * @description Add a js comment to the processed content
     * @param {IPugDocBlock}    block       Block with the content to add the comments
     */
    protected _parseToJsComment(block:IPugDocBlock){
        let raw = block.lines.join("\n");
        raw = "/**"+raw+"*/";
        block.raw = raw;
    }
    protected _jsDocExplainAsync(blocks){

    }
}
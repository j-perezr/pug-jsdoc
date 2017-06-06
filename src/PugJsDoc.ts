import * as map from "map-stream";
import * as vfs from "vinyl-fs";
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
export class PugJsDoc{
    protected _map = map;
    protected _vfs = vfs;
    protected _parsed;
    protected _options:IPugJsDocOptions;
    constructor(options:IPugJsDocOptions){
        this._options = options;
    }
    renderAsync(src?){
        this._parsed = [];
    }
    explainAsync(src?){
        this._parsed = [];
        this._start(src || this._options.src);
    }
    protected _start(src){
        this._vfs.src(src)
            .pipe(this._map(this._onReadFile.bind(this)))
            .on("error",this._onProcessFileError)
            .on("end",this._onEnd)
    }
    protected _onEnd(){

    }
    protected _onProcessFileError(e){
        console.error(e.message);
    }
    protected _onReadFile(file,cb){
        this._parsed.push(this._processFile(file));
        cb(null, file);
    }
    protected _ensureOpenCloseTag(fileContent){
        let open = fileContent.match(/@pugdoc/gm),
            close = fileContent.match(/@endpugdoc/gm),
            result = false;
        if(open != undefined && close !=undefined){
            result = open.length === close.length;
        }if(open == undefined && close == undefined){
            result = true;
        }
        return result;
    }
    protected _isStartOfBlock(line:string):boolean{
        return line.search(/@pugdoc/) !== -1;
    }
    protected _processStartBlock(line:string):string{
        let parsedLine = line.replace(/(\/\/-?\s*|@pugdoc\s*)/g, "");
        return parsedLine;
    }
    protected _isEndOfBlock(line:string):boolean{
        return line.search(/@endpugdoc/) !== -1;
    }
    protected _processEndOfBlock(line:string):string{
        let parsedLine = line.replace(/(\/\/-?\s*|@endpugdoc\s*)/g, "").trim();
        return parsedLine;
    }
    protected _countSpacesAtTheBegining(line:string):number{
        let spacesMatch= line.match(/^([\s|\t]+)/),
            spaces = spacesMatch ? spacesMatch.length : 0;
        return spaces;
    }
    protected _markErrorLine(lineIndex,lines){
        let msg = lines.concat([]);
        let mark = new Array(lines[lineIndex].length).fill("^").join("");
        msg.splice(lineIndex,0,mark);
        msg = msg.join("\n");
        return msg;
    }
    protected _processFile(file){
        let blocks = [],
            fileContent = file.contents.toString(),
            lines = fileContent.split('\n'),
            currentBlock,
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
                        currentBlock = [];
                        //remove the special tag preserving the rest
                        let parsedLine = this._processStartBlock(lineToProcess);
                        //start the block
                        currentBlock.push(parsedLine);
                        //count the indentation to control the indentation
                        spaces = this._countSpacesAtTheBegining(lineToProcess);
                    } else {
                        //if some block is being processed, throw an error
                        let errorHighlight = this._markErrorLine(lineIndex,lines);
                        throw new Error(`Maybe forgot to close a block with @endpugdoc?\n${errorHighlight}\nat ${file.path}:${lineIndex}`);
                    }
                } else {//if is not a start
                    //check the indentation
                    let currentSpaces = this._countSpacesAtTheBegining(line);
                    if(currentSpaces <= spaces){
                        let errorHighlight = this._markErrorLine(lineIndex,lines);
                        throw new Error(`Maybe forgot to close a block with @endpugdoc?\n${errorHighlight}\nat ${file.path}:${lineIndex}`);
                    }
                    //check if is the end of a block
                    if (this._isEndOfBlock(lineToProcess)) {
                        if (currentBlock) {
                            //remove the special tag preserving the rest
                            let parsedLine = this._processEndOfBlock(lineToProcess);
                            currentBlock.push(parsedLine);
                            //store the block
                            blocks.push(currentBlock);
                            //reset the current block
                            currentBlock = null;
                        }
                    } else {
                        //if is not a start or end of a block
                        currentBlock.push(lineToProcess);
                    }
                }
            }
        }
    }
    protected _parseToJsComment(){

    }
}
import fs from 'fs'
import { exec } from 'child_process'
const load = require('audio-loader')

type content = {
    id:number;
    text:string;
    startingTime:number;
    filename:string;
    duration:number;
    endingTime:number;
}


let objectInd = 0
const contents: string = fs.readFileSync('input.json', 'utf8')
const contentJson: Array<content> = JSON.parse(contents)

let genAudio = function ():Promise<string>{

    const date:string = new Date().toString().replace(/[{(+)}]|GMT|0530|India Standard Time| /g, '')
    const data:string = contentJson[objectInd].text
    const fileName:string = `audio/index-${contentJson[objectInd].id}-${date}`

    let myPromise = new Promise<string>((resolve, reject) => {
 
          exec(`./tts --text "${data}" --out_path ${fileName}.wav`, (error, stdout, stderr) => {
            if (error) {
              console.log(`error: ${error.message}`)
              return
            }
            if (stderr) {
              console.log(`stderr: ${stderr}`)
              return
            }
            if (stdout) {
              console.log(`stdout: ${stdout}`)
              const data1:string = fileName
              contentJson[objectInd].filename = `${fileName}.wav`
              resolve(data1)
            }
          })
      })
      return myPromise

}
let duration = function(data1:string):Promise<string>{
    const fileName:string = `${data1}.wav`
    let myPromise = new Promise<string>((resolve, reject) => {
        load(fileName).then(function (res: { duration: number }) {
            const duration:number = res.duration
            contentJson[objectInd].duration = duration
            const startingTime:number = contentJson[objectInd].startingTime

            if (objectInd === 0){
                contentJson[objectInd].endingTime = startingTime + duration 
            }

            else if(objectInd > 0 && startingTime < contentJson[objectInd-1].endingTime ){
                contentJson[objectInd].startingTime = contentJson[objectInd-1].endingTime + 5
                contentJson[objectInd].endingTime = contentJson[objectInd].startingTime + duration  
            }

            else if(objectInd > 0 && startingTime > contentJson[objectInd-1].endingTime ){
                contentJson[objectInd].endingTime =  startingTime + duration 
            }

            resolve("duration got")
        })
    })
    return myPromise

}

let recur = function(){

    if(objectInd < contentJson.length-1){
        objectInd++
        genAudio().then(duration).then(recur)
    }
    else{
        fs.writeFileSync('output.json', JSON.stringify(contentJson, null, 2), 'utf8')
    }

}

genAudio().then(duration).then(recur)
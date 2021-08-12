import fs from 'fs'
import { exec } from 'child_process'
const load = require('audio-loader')

type content = {
    id:number;
    text:string;
    startingTime:number;
    audioFilename:string;
    duration:number;
    endingTime:number;
}
type main = {
    detail:Array<content>;
    videoFilename:string;
}

type crossMain = {
    mainObj:main;
    cliPath:string;
}


let objectInd = 0
const contents: string = fs.readFileSync('input.json', 'utf8')
const contentJson: Array<content> = JSON.parse(contents)
const date:string = new Date().toString().replace(/[{(+)}]|GMT|0530|India Standard Time| /g, '')

let genAudio = function ():Promise<string>{

    console.log('Audio gen')

    const data:string = contentJson[objectInd].text
    const fileName:string = `audio/index-${contentJson[objectInd].id}-${date}.wav`

    let myPromise = new Promise<string>((resolve, reject) => {
 
          exec(`./tts --text "${data}" --out_path ${fileName}`, (error, stdout, stderr) => {
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
              contentJson[objectInd].audioFilename = `${fileName}`
              resolve('Audio Generated')
            }
          })
      })
      return myPromise
}

let duration = function():Promise<string>{
    console.log('duration cap')

    const fileName:string = `${contentJson[objectInd].audioFilename }`
    
    let myPromise = new Promise<string>((resolve, reject) => {

        load(fileName).then(function (res: { duration: number }) {
            contentJson[objectInd].duration = res.duration
            resolve('Duration Captured')
        })
    })
    return myPromise
}

let speedCheck = function(){

    console.log('speed check')
    const duration1:number =  contentJson[objectInd].duration
    const startingTime:number = contentJson[objectInd].startingTime
    const endingTime = startingTime + duration1 

    if(objectInd < contentJson.length-1 && endingTime >= contentJson[objectInd + 1 ].startingTime ){
        console.log('speed over')
        const ratio:number = endingTime/contentJson[objectInd + 1 ].startingTime
        playBackSpeed(ratio).then(duration).then(speedCheck)
    }
    else{
        console.log('correct speed')
        contentJson[objectInd].endingTime = endingTime
        recur()
    }
}

let playBackSpeed = function (ratio:number):Promise<string>{

    console.log('play back speed adjust')

    const fileName:string = `${contentJson[objectInd].audioFilename }`
    const fileName2:string = `audio/index-${contentJson[objectInd].id}-${date}.${ratio}.wav`
    console.log(ratio)
    const cliString:string = `ffmpeg -i ${fileName} -filter:a "atempo=${ratio}" -vn ${fileName2}`

    let myPromise = new Promise<string>((resolve, reject) => {

        exec(`${cliString}`, (error, stderr, stdout) => {
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
              fs.unlinkSync(`${fileName}`)
              contentJson[objectInd].audioFilename = `${fileName2}`
              fs.writeFileSync('output.json', JSON.stringify(contentJson, null, 2), 'utf8')
              resolve('Playback speed is increased')
            }
          })
    })
    return myPromise
}

let recur = function(){
    console.log('recur')
    if(objectInd < contentJson.length-1){
        objectInd++
        genAudio().then(duration).then(speedCheck)
    }
    else{
        let mainJson = <main>{}
        mainJson.detail = contentJson
        mainJson.videoFilename = `video/${date}.old`
        fs.writeFileSync('output.json', JSON.stringify(mainJson, null, 2), 'utf8')
        cliPathGenVideoAudio().then(videoGen).then(backroundMusic)
    }
}

let cliPathGenVideoAudio = function ():Promise<crossMain>{

    const contents: string = fs.readFileSync('output.json', 'utf8')
    const mainJson: main = JSON.parse(contents)
    const contentJson: Array<content> = mainJson.detail
    const videoFilename:string = `${mainJson.videoFilename}.mp4`

    const myPromise = new Promise<crossMain>((resolve, reject) => {

        let first:string = ''
        let second:string = ''
        let third:string =''

        for (let i:number = 0; i < contentJson.length; i++){

            first += ` -i ${contentJson[i].audioFilename}`
            second += `[${i+1}]adelay=delays=${contentJson[i].startingTime}s:all=1[r${i+1}]; `
            third += `[r${i+1}]`
        }
        const cliPath:string = `ffmpeg -y -i video.mp4${first} -filter_complex "${second}${third}amix=inputs=${contentJson.length}[a]"  -map 0:v -map "[a]" -codec:v copy ${videoFilename}`
        console.log(cliPath)
        const MainBigObject = <crossMain>{}
        MainBigObject.mainObj = mainJson
        MainBigObject.cliPath = cliPath
        resolve(MainBigObject)
    })
    return myPromise
}

let videoGen = function (MainBigObject:crossMain):Promise<crossMain>{

    const cliPath:string = MainBigObject.cliPath

    const myPromise = new Promise<crossMain>((resolve, reject) => {

        exec(`${cliPath}`, (error, stderr, stdout) => {
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
              resolve(MainBigObject)
            }
          })
    })
    return myPromise
}

let backroundMusic = function (MainBigObject:crossMain):Promise<string>{

    const oldVideoFile:string = `${MainBigObject.mainObj.videoFilename}.mp4`
    const newVideoFile:string = `video/${date}.mp4`


    const cliPath:string = `ffmpeg -i bgm.wav -i ${oldVideoFile} -filter_complex \ "[0:a]volume=0.05[a1];[1:a]volume=4[a2];[a1][a2]amerge,pan=stereo|c0<c0+c2|c1<c1+c3[out]" -map 1:v -map "[out]" -c:v copy -c:a aac -shortest ${newVideoFile}`

    const myPromise = new Promise<string>((resolve, reject) => {

        exec(`${cliPath}`, (error, stderr, stdout) => {
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
              fs.unlinkSync(`${oldVideoFile}`)
              resolve('Video Generated')
            }
        })
    })
    return myPromise
}



genAudio().then(duration).then(speedCheck)



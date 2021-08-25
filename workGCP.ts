import fs from 'fs'
import { exec } from 'child_process'
const load = require('audio-loader')
import textToSpeech from '@google-cloud/text-to-speech'
import util from 'util'
import { parse } from 'node-html-parser'
const subsrt = require('subsrt')
const client = new textToSpeech.TextToSpeechClient()


type voice = {
    languageCode:string;
    name:string;
}

type language = {
    [property:string]:voice
}

type audioConfig = {
    audioEncoding:any;
    pitch:number;
    speakingRate:number;
}

type languageJson = {
    audioConfig:audioConfig;
    language:language;
}

type inputJson = {
    id:number;
    text:string;
    startingTime:number;
}

type content = {
    id:number;
    audioFilename:string;
    duration:number;
    endingTime:number;
}

type main = {
    detail:Array<content>;
    videoFilename:string;
}

type output = {
    [property:string]:main
}

type outputJsonConfig = {
    input:Array<inputJson>;
    output:output;
}

type crossMain = {
    mainObj:main;
    cliPath:string;
}

type passObj = {
    ratio:number;
    contentDet:content;
}

type subtitleConfig = {
    start:number;
    end:number;
    text:string;
}

const subJson:Array<subtitleConfig> = []

let i:number = 0
let j:number = 1

let startTime:number = 0

let startingInd:number = 0
let endingInd:number = 0

let partOfSentence:number = 1
let stringCountPerSentence:number = 0
let durationPerSentence:number = 0

let nText:string = ''
let stringLen:number = 0
let outputDetail:Array<content> = []

let objectInd:number = 0
let languageInd:number = 0

let input:Array<inputJson> = []
let detail:Array<content> = []

const audioLangConfig: string = fs.readFileSync('input-source/language.json', 'utf8')

const audioLangConfigJson:languageJson = JSON.parse(audioLangConfig)

const audioConfigObject:audioConfig = audioLangConfigJson.audioConfig

const languageConfigObject:language = audioLangConfigJson.language

const country:Array<string> = Object.keys(languageConfigObject)

let inputJsonGen = function ():Promise<string>{

    let myPromise = new  Promise<string>  (async(resolve, reject)  =>  {

        const sourceText: string = fs.readFileSync('input-source/sourceText.txt', 'utf8')

        const root = parse(sourceText)

        const tagCount:number = root.querySelectorAll('tts').length

        for(let i:number = 1; i <= tagCount; i++){

            const data = <inputJson>{}

            data.id = i
            data.text = root.querySelector(`tts:nth-of-type(${i})`).innerText
            data.startingTime = Number(root.querySelector(`tts:nth-of-type(${i})`).attrs.t)/1000

            input[i-1] = data
        }
        resolve('Input Json Generated')
    })
    return myPromise
}

let genAudio =  function ():Promise<content>{

    console.log('Audio gen')

    let contentDet = <content>{}

    const fileName:string = `video/audio/index-${input[objectInd].id}-${country[languageInd]}.mp3`

    let myPromise = new  Promise<content>  (async(resolve, reject)  =>  {

        const request = {
            "audioConfig":audioConfigObject,
            "input":{"text":input[objectInd].text},
            "voice":languageConfigObject[country[languageInd]]
        }

        const [response]:any = await client.synthesizeSpeech(request)
        
        const writeFile = util.promisify(fs.writeFile)
   
        await writeFile(`${fileName}`, response.audioContent, 'binary')
  
        console.log('Audio Generated')
        contentDet.audioFilename = `${fileName}`
        contentDet.id = input[objectInd].id
        resolve(contentDet)

    })
    return myPromise
}

let duration = function(contentDet:content):Promise<content>{
    console.log('duration cap')

    const fileName:string = `${contentDet.audioFilename }`
    
    let myPromise = new Promise<content>((resolve, reject) => {

        load(fileName).then(function (res: { duration: number }) {
            contentDet.duration = res.duration
            resolve(contentDet)
        })
    })
    return myPromise
}

let speedCheck = function(contentDet:content){

    console.log('speed check')
    const duration1:number =  contentDet.duration
    const startingTime:number = input[objectInd].startingTime
    const endingTime = startingTime + duration1 

    if(objectInd < input.length-1 && endingTime >= input[objectInd + 1 ].startingTime ){
        console.log('speed over')
        const ratio:number = endingTime/(input[objectInd + 1 ].startingTime - 0.2 )
        const passingObject = <passObj>{}
        passingObject.ratio = ratio
        passingObject.contentDet = contentDet
        playBackSpeed(passingObject).then(duration).then(speedCheck)
    }
    else{
        console.log('correct speed')
        contentDet.endingTime = endingTime
        recur1(contentDet)
    }
}

let playBackSpeed = function (passingObject:passObj):Promise<content>{

    console.log('play back speed adjust')

    const ratio = passingObject.ratio
    const contentDet = passingObject.contentDet

    const fileName:string = `${contentDet.audioFilename }`
    const fileName2:string = `video/audio/index-${input[objectInd].id}-${country[languageInd]}.${ratio}.mp3`
    console.log(ratio)
    const cliString:string = `ffmpeg -i ${fileName} -filter:a "atempo=${ratio}" -vn ${fileName2}`

    let myPromise = new Promise<content>((resolve, reject) => {

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
              contentDet.audioFilename = `${fileName2}`
              resolve(contentDet)
            }
          })
    })
    return myPromise
}

let recur1 = function(contentDet:content){
    console.log('recur')
    detail[objectInd] = contentDet
    if(objectInd < input.length-1){
        objectInd++
        genAudio().then(duration).then(speedCheck)
    }
    else{
        let mainJson = <main>{}
        mainJson.detail = detail
        mainJson.videoFilename = `video/output-video/${country[languageInd]}.old`

        cliPathGenVideoAudio(mainJson).then(videoGen).then(backroundMusic).then(recur2)
    }
}

let cliPathGenVideoAudio = function (Json:main):Promise<crossMain>{


    const detail: Array<content> = Json.detail
    const videoFilename:string = `${Json.videoFilename}.mp4`

    const myPromise = new Promise<crossMain>((resolve, reject) => {

        let first:string = ''
        let second:string = ''
        let third:string =''

        for (let i:number = 0; i < detail.length; i++){

            first += ` -i ${detail[i].audioFilename}`
            second += `[${i+1}]adelay=delays=${input[i].startingTime}s:all=1[r${i+1}]; `
            third += `[r${i+1}]`
        }
        const cliPath:string = `ffmpeg -y -i video/SourceVideo.mp4${first} -filter_complex "${second}${third}amix=inputs=${detail.length}[a]"  -map 0:v -map "[a]" -codec:v copy ${videoFilename}`
        console.log(cliPath)
        const MainBigObject = <crossMain>{}
        MainBigObject.mainObj = Json
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
    const newVideoFile:string = `video/output-video/${country[languageInd]}.mp4`
    MainBigObject.mainObj.videoFilename = newVideoFile

    const countryName:string = country[languageInd]

    let outputJson = <outputJsonConfig>{}


    if (languageInd === 0) {
        outputJson.input = input
        let outputCountry = <output>{}
        outputCountry[countryName] = MainBigObject.mainObj
        outputJson.output = outputCountry
    }
    else{
        const outputJsonString: string = fs.readFileSync('json-output/output.json', 'utf8')
        outputJson = JSON.parse(outputJsonString)
        outputJson.output[countryName] = MainBigObject.mainObj
    }

    const cliPath:string = `ffmpeg -i ${oldVideoFile} -i video/bgm1.mp3 -filter_complex "[0:a]volume=10,apad[A];[1:a][A]amerge[out]" -c:v copy -map 0:v -map [out] -y -shortest ${newVideoFile}`

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
              outputDetail = outputJson.output.india.detail
              fs.unlinkSync(`${oldVideoFile}`)
              fs.writeFileSync('json-output/output.json', JSON.stringify(outputJson, null, 2), 'utf8')
              resolve('Video Generated')
            }
        })
    })
    return myPromise
}

let recur2 = function (){

    if(languageInd < country.length-1){
        languageInd++
        objectInd = 0
        genAudio().then(duration).then(speedCheck)
    }
    else{
        first()
    }
}

function first () {
  nText = input[i].text
  startTime = input[i].startingTime
  const duration = outputDetail[i].duration
  stringLen = nText.length
  if (stringLen >= 100) { trimText(duration) } else { subJsonGen(nText, duration) }
}

function trimText (duration:number) {
  partOfSentence = Math.ceil(stringLen / 100)
  stringCountPerSentence = Math.ceil(stringLen / partOfSentence)
  durationPerSentence = duration / partOfSentence
  endingInd = stringCountPerSentence
  slice()
}

function subJsonGen (newsSentence:string, duration:number) {
  const data = <subtitleConfig>{}
  data.start = (startTime * 1000)
  data.end = Math.round((startTime + duration - 0.2) * 1000)
  data.text = newsSentence
  subJson.push(data)
  startTime = startTime + durationPerSentence
  if (partOfSentence > j) { j++; slice() } else if (i < input.length - 1) { i++; first() }
  else {
    subtitle()
    console.log(subJson)
  }
}

function slice () {
  if (nText[endingInd] === '') {
    const text = nText.slice(startingInd, endingInd)
    startingInd = endingInd
    if (j === partOfSentence - 1) { endingInd = stringLen } else { endingInd = startingInd + stringCountPerSentence }
    startingInd++
    subJsonGen(text, durationPerSentence)
  } else {
    const index = nText.indexOf('', endingInd)
    const text = nText.slice(startingInd, index)
    startingInd = endingInd
    if (j === partOfSentence - 1) { endingInd = stringLen } else { endingInd = startingInd + stringCountPerSentence }
    subJsonGen(text, durationPerSentence)
  }
}

function subtitle () {
  const options = { format: 'srt' }
  const content = subsrt.build(subJson, options)
  fs.writeFileSync('json-output/generated.srt', content)
}

inputJsonGen().then(genAudio).then(duration).then(speedCheck)



// export GOOGLE_APPLICATION_CREDENTIALS="/home/androws/Documents/Zoho/Video_Search/audio-from-text.json"

//const cliPath:string = `ffmpeg -i bgm.wav -i ${oldVideoFile} -filter_complex \ "[0:a]volume=0.05[a1];[1:a]volume=4[a2];[a1][a2]amerge,pan=stereo|c0<c0+c2|c1<c1+c3[out]" -map 1:v -map "[out]" -c:v copy -c:a aac -shortest ${newVideoFile}`

// ffmpeg -i bgmOrg.mp3 -af 'volume=0.1' bgm1.mp3

// ffmpeg -i test.mp4 -i bgm1.mp3 -filter_complex "[0:a]volume=10,apad[A];[1:a][A]amerge[out]" -c:v copy -map 0:v -map [out] -y -shortest output-final.mp4




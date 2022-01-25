import * as fs from 'fs'
import { exec } from 'child_process'
const load = require('audio-loader')
import textToSpeech from '@google-cloud/text-to-speech'
import * as util from 'util'
import { parse } from 'node-html-parser'
const subsrt = require('subsrt')
const client = new textToSpeech.TextToSpeechClient()


type voice = {
  languageCode: string;
  name: string;
}

type language = {
  [property: string]: voice
}

type audioConfig = {
  audioEncoding: any;
  pitch: number;
  speakingRate: number;
}

type languageJson = {
  audioConfig: audioConfig;
  language: language;
}

type inputJson = {
  id: number;
  text: string;
  startingTime: number;
  type: string;
  subtitle: string;
}

type content = {
  id: number;
  audioFilename: string;
  duration: number;
  endingTime: number;
}

type main = {
  detail: Array<content>;
  videoFilename: string;
}

type output = {
  [property: string]: main
}

type outputJsonConfig = {
  input: Array<inputJson>;
  output: output;
}

type crossMain = {
  mainObj: main;
  cliPath: string;
}

type passObj = {
  ratio: number;
  contentDet: content;
}

type subtitleConfig = {
  start: number;
  end: number;
  text: string;
}

const subJson: Array<subtitleConfig> = []

let indexOfInputText: number = 0
let indexOfSlicedText: number = 1

let startTime: number = 0

let startingInd: number = 0
let endingInd: number = 0

let partOfSentence: number = 1
let stringCountPerSentence: number = 0
let durationPerSentence: number = 0

let nText: string = ''
let stringLen: number = 0
let outputDetail: Array<content> = []

let objectInd: number = 0
let languageInd: number = 0

let input: Array<inputJson> = []
let detail: Array<content> = []

let audioFiles: Array<string> = []



const audioLangConfig: string = fs.readFileSync('input-source/language.json', 'utf8')

const audioLangConfigJson: languageJson = JSON.parse(audioLangConfig)

const audioConfigObject: audioConfig = audioLangConfigJson.audioConfig

const languageConfigObject: language = audioLangConfigJson.language

const country: Array<string> = Object.keys(languageConfigObject)


let folderCreation = function (): Promise<any> {

  console.log('Folder creating/updating process started')

  const dirNames = fs.readdirSync('video')

  const myPromise = new Promise<any>((resolve, reject) => {

    if (dirNames.includes('compressed-audio')) {
      fs.rmSync('video/compressed-audio', { recursive: true })
      fs.mkdirSync('video/compressed-audio', { recursive: true })
    }

    if (!dirNames.includes('compressed-audio')) {
      fs.mkdirSync('video/compressed-audio', { recursive: true })
    }

    if (!dirNames.includes('gcp-audio')) {
      fs.mkdirSync('video/gcp-audio', { recursive: true })
    }

    if (dirNames.includes('output-video')) {
      fs.rmSync('video/output-video', { recursive: true })
      fs.mkdirSync('video/output-video', { recursive: true })
    }

    if (!dirNames.includes('output-video')) {
      fs.mkdirSync('video/output-video', { recursive: true })
    }

    if (dirNames.includes('bgm1.mp3')) {
      fs.rmSync('video/bgm1.mp3', { recursive: true })
    }

    resolve({ cmd: `ffmpeg -i video/bgm.mp3 -af volume=0.2 video/bgm1.mp3`, old: 'video/bgm.mp3' })
  })
  console.log('Folder creating/updating process completed')
  return myPromise
}


let inputJsonGen = function (): Promise<string> {

  console.log('Input Json is generating from source file')

  let myPromise = new Promise<string>(async (resolve, reject) => {

    const sourceText: string = fs.readFileSync('input-source/sourceText.txt', 'utf8')

    audioFiles = fs.readdirSync('video/gcp-audio')

    const root = parse(sourceText)

    const tagCount: number = root.querySelectorAll('tts').length

    for (let i: number = 1; i <= tagCount; i++) {

      const data = <inputJson>{}

      data.id = i
      data.text = root.querySelector(`tts:nth-of-type(${i})`).innerHTML
      data.subtitle = root.querySelector(`tts:nth-of-type(${i})`).innerText
      data.startingTime = Math.ceil(Number(root.querySelector(`tts:nth-of-type(${i})`).attrs.t) / 1000)
      data.type = root.querySelector(`tts:nth-of-type(${i})`).attrs.type

      input[i - 1] = data
      if (data.text.length >= 5000) {
        reject(`${i}th tag exceed the charecter limit,The request should be in 5000 charecter maximum`)
      }
    }
    resolve('Input Json Generated')
  })
  console.log('Input Json generated')
  return myPromise
}

let genAudio = function (): Promise<content> {

  console.log('Audio is generating from input Json')

  let contentDet = <content>{}

  const fileName: string = `video/gcp-audio/index-${input[objectInd].id}-${country[languageInd]}.mp3`

  let myPromise = new Promise<content>(async (resolve, reject) => {

    if (!audioFiles.includes(fileName)) {

      let input_Source: any

      if (input[objectInd].type === "text") {
        input_Source = { "text": input[objectInd].text }
      }
      else {
        input_Source = { "ssml": input[objectInd].text }
      }

      const request = {
        "audioConfig": audioConfigObject,
        "input": input_Source,
        "voice": languageConfigObject[country[languageInd]]
      }

      const [response]: any = await client.synthesizeSpeech(request)

      const writeFile = util.promisify(fs.writeFile)

      await writeFile(`${fileName}`, response.audioContent, 'binary')
    }
    contentDet.audioFilename = `${fileName}`
    contentDet.id = input[objectInd].id
    resolve(contentDet)
  })
  console.log('Audio is generated')
  return myPromise
}

let duration = function (contentDet: content): Promise<content> {

  console.log('Audio duration is checking')

  const fileName: string = `${contentDet.audioFilename}`

  let myPromise = new Promise<content>((resolve, reject) => {

    load(fileName).then(function (res: { duration: number }) {

      contentDet.duration = res.duration

      resolve(contentDet)
    })
  })
  console.log('Audio duration is checked')
  return myPromise
}

let speedCheck = function (contentDet: content) {

  console.log('Audio speed is checking')

  const duration1: number = contentDet.duration
  const startingTime: number = input[objectInd].startingTime
  const endingTime = startingTime + duration1

  if (objectInd < input.length - 1 && endingTime >= input[objectInd + 1].startingTime) {

    console.log('Audio placback speed is less')

    const ratio: number = endingTime / (input[objectInd + 1].startingTime - 0.2)
    const passingObject = <passObj>{}
    passingObject.ratio = ratio
    passingObject.contentDet = contentDet

    const ratioCheck = parseFloat(ratio.toString().substr(0, 5))

    console.log('Audio placback speed ration is', ratio)

    if (ratioCheck > 1.001) {
      playBackSpeed(passingObject).then(duration).then(speedCheck)
    }
    else {
      contentDet.endingTime = endingTime
      recur1(contentDet)
    }
  }
  else {
    contentDet.endingTime = endingTime
    recur1(contentDet)
  }
}

let playBackSpeed = async function (passingObject: passObj): Promise<content> {

  console.log('Audio play back speed is adjusting')

  const ratio = passingObject.ratio
  const contentDet = passingObject.contentDet

  const fileName: string = `${contentDet.audioFilename}`
  const fileName2: string = `video/compressed-audio/index-${input[objectInd].id}-${country[languageInd]}.${ratio}.mp3`
  const cliString: string = `ffmpeg -i ${fileName} -filter:a "atempo=${ratio}" -vn ${fileName2}`

  await cliExcute(cliString)

  if (fileName.includes('compressed-audio')) {
    fs.unlinkSync(`${fileName}`)
  }

  contentDet.audioFilename = `${fileName2}`

  console.log('Audio play back speed is adjusted')

  return contentDet
}


let recur1 = function (contentDet: content) {

  detail[objectInd] = contentDet

  if (objectInd < input.length - 1) {
    objectInd++
    genAudio().then(duration).then(speedCheck)
  }
  else {
    let mainJson = <main>{}
    mainJson.detail = detail
    mainJson.videoFilename = `video/output-video/${country[languageInd]}.old`

    cliPathGenVideoAudio(mainJson).then(videoGen).then(backroundMusic).then(volumeAdjust).then(recur2)
  }
}

let cliPathGenVideoAudio = function (Json: main): Promise<crossMain> {

  console.log('CLI command is generating for video generate')

  const detail: Array<content> = Json.detail
  const videoFilename: string = `${Json.videoFilename}.mp4`

  const myPromise = new Promise<crossMain>((resolve, reject) => {

    let first: string = ''
    let second: string = ''
    let third: string = ''

    for (let i: number = 0; i < detail.length; i++) {

      first += ` -i ${detail[i].audioFilename}`
      second += `[${i + 1}]adelay=delays=${input[i].startingTime}s:all=1[r${i + 1}]; `
      third += `[r${i + 1}]`
    }
    const cliPath: string = `ffmpeg -y -i video/SourceVideo.mp4${first} -filter_complex "${second}${third}amix=inputs=${detail.length}[a]"  -map 0:v -map "[a]" -codec:v copy ${videoFilename}`

    const MainBigObject = <crossMain>{}
    MainBigObject.mainObj = Json
    MainBigObject.cliPath = cliPath
    resolve(MainBigObject)
  })
  console.log('CLI command is generated for video generate')
  return myPromise
}

let videoGen = async function (MainBigObject: crossMain): Promise<crossMain> {

  console.log('Video is generating')

  const cliPath: string = MainBigObject.cliPath

  await cliExcute(cliPath)

  console.log('Video is generated')

  return MainBigObject
}

let volumeAdjust = async function (configObj: any): Promise<any> {

  console.log('Volume is adjsting')

  const cliPath = configObj.cmd

  await cliExcute(cliPath)

  console.log('Volume is adjsted')

  return configObj.old
}

let backroundMusic = async function (MainBigObject: crossMain): Promise<any> {

  console.log('Adding backround music')

  const oldVideoFile: string = `${MainBigObject.mainObj.videoFilename}.mp4`
  const oldVideoFile2: string = `${MainBigObject.mainObj.videoFilename}1.mp4`
  const newVideoFile: string = `video/output-video/${country[languageInd]}.mp4`
  MainBigObject.mainObj.videoFilename = newVideoFile

  const countryName: string = country[languageInd]

  let outputJson = <outputJsonConfig>{}

  if (languageInd === 0) {
    outputJson.input = input
    let outputCountry = <output>{}
    outputCountry[countryName] = MainBigObject.mainObj
    outputJson.output = outputCountry
  }
  else {
    const outputJsonString: string = fs.readFileSync('json-output/output.json', 'utf8')
    outputJson = JSON.parse(outputJsonString)
    outputJson.output[countryName] = MainBigObject.mainObj
  }

  const cliPath: string = `ffmpeg -i ${oldVideoFile} -filter_complex "amovie=video/bgm1.mp3:loop=0,asetpts=N/SR/TB[aud];[0:a][aud]amix[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 256k -shortest ${oldVideoFile2}`

  await cliExcute(cliPath)

  outputDetail = outputJson.output.india.detail
  fs.unlinkSync(`${oldVideoFile}`)
  fs.writeFileSync('json-output/output.json', JSON.stringify(outputJson, null, 2), 'utf8')

  console.log('Added backround music')
  return { cmd: `ffmpeg -i ${oldVideoFile2} -af volume=10 -vcodec copy ${newVideoFile}`, old: oldVideoFile2 }
}


let recur2 = function (oldVideoFile: any) {

  fs.unlinkSync(`${oldVideoFile}`)

  if (languageInd < country.length - 1) {
    languageInd++
    objectInd = 0
    genAudio().then(duration).then(speedCheck)
  }
  else {
    fs.unlinkSync('video/bgm1.mp3')
    firstSubtitleGen()
  }
}

let cliExcute = function (cliString: string): Promise<content | string> {

  console.log('CLI process is started')

  let myPromise = new Promise<content | string>((resolve, reject) => {

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
        // console.log(`stdout: ${stdout}`)
        resolve('CLI process completed')
      }
    })
  })
  console.log('CLI process completed')
  return myPromise
}

function firstSubtitleGen() {

  console.log('Subtitle is gnerating')
  nText = input[indexOfInputText].subtitle.split(/\r?\n/).join(' ')
  startTime = input[indexOfInputText].startingTime
  const duration = outputDetail[indexOfInputText].duration
  stringLen = nText.length
  trimText(duration)
}

function trimText(duration: number) {

  if (stringLen >= 60) {
    partOfSentence = Math.ceil(stringLen / 60)
    stringCountPerSentence = Math.ceil(stringLen / partOfSentence)
  } else {
    stringCountPerSentence = stringLen
  }

  durationPerSentence = duration / partOfSentence
  endingInd = stringCountPerSentence
  sliceText()
}

function subJsonGen(newsSentence: string, duration: number) {

  const data = <subtitleConfig>{}
  data.start = (startTime * 1000)
  data.end = Math.round((startTime + duration - 0.2) * 1000)
  data.text = newsSentence
  subJson.push(data)
  startTime = startTime + durationPerSentence

  if (partOfSentence > indexOfSlicedText) { indexOfSlicedText++; sliceText() }
  else if (indexOfInputText < input.length - 1) { indexOfInputText++; indexOfSlicedText = 1; startingInd = 0; firstSubtitleGen() }
  else {
    subtitle()
  }
}

function sliceText() {

  if (nText[endingInd] === ' ') {
    const text = nText.slice(startingInd, endingInd)
    console.log(text, 'sp2')
    startingInd = endingInd

    if (indexOfSlicedText === partOfSentence - 1) { endingInd = stringLen } else { endingInd = startingInd + stringCountPerSentence }

    startingInd++
    subJsonGen(text, durationPerSentence)
  }
  else {
    const index = nText.indexOf(' ', endingInd)
    const text = nText.slice(startingInd, index)
    endingInd = index
    startingInd = endingInd

    if (indexOfSlicedText === partOfSentence - 1) { endingInd = stringLen }
    else { endingInd = startingInd + stringCountPerSentence }

    subJsonGen(text, durationPerSentence)
  }
}

function subtitle() {
  const options = { format: 'srt' }
  const content = subsrt.build(subJson, options)
  fs.writeFileSync('json-output/generated.srt', content)
  console.log('Subtitle is gnerated')
}

folderCreation().then(volumeAdjust).then(inputJsonGen).then(genAudio).then(duration).then(speedCheck)

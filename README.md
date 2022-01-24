Refer below link to understand the workflo

https://cloud.google.com/text-to-speech/docs

Create a account in GCP.

Generate credential key for Text to speech service api and run the below command before running the script.

export GOOGLE_APPLICATION_CREDENTIALS="/home/andrews-zt589/Documents/Zoho/excercise_task/Video_Search-test/audio-from-text.json"

Make Directory parraelle to script file in the name of "video".

Inside that put bgm file and source video in the name of "bgm.mp3" and "SourceVideo.mp4" respectivly

Make Directories parraellel to script file in the name of "input-source" and "json-output"

Inside "input-source" Directory put source text and laguage configuration in the name of "sourceText.txt" and "language.json" respectivly

run ts-node workGCP.ts

to reduce/increase the volume of bgm use below command

ffmpeg -i bgmOrg.mp3 -af 'volume=0.1' bgm1.mp3


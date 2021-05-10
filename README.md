# wav.js
A javascript library for accessing and modifying low-level data in .wav files.

Example Usage:

```js
var myFile = document.getElementById('myInputElement').files[0]

var myWav;
var reader = new FileReader();
reader.onload = function() {
  var convertedData = new Uint8Array(reader.result);
  
  myWav = new wave(convertedData);
  console.log(myWav.properties.sample_rate);
}

reader.readAsArrayBuffer(myFile);
```

#### See the [documentation](https://github.com/koerismo/wav.js/wiki) for more information.

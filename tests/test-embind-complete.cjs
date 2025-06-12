const createTagLibModule = require("../build/taglib.js");
const fs = require("fs");
const path = require("path");

async function test() {
  console.log("Loading TagLib module...");
  const module = await createTagLibModule();
  console.log("Module loaded!");
  
  // Load a test MP3 file
  const mp3Path = path.join(__dirname, "test-files/mp3/kiss-snippet.mp3");
  const mp3Buffer = fs.readFileSync(mp3Path);
  console.log(`Loaded MP3 file: ${mp3Buffer.length} bytes`);
  
  // Create a FileHandle
  const fileHandle = module.createFileHandle();
  console.log("FileHandle created");
  
  // Convert buffer to string for Embind
  const binaryString = Array.from(mp3Buffer, byte => String.fromCharCode(byte)).join('');
  console.log(`Binary string length: ${binaryString.length}`);
  
  // Load the buffer
  const loaded = fileHandle.loadFromBuffer(binaryString);
  console.log(`File loaded: ${loaded}`);
  
  // Check if valid
  const isValid = fileHandle.isValid();
  console.log(`File is valid: ${isValid}`);
  
  // Get format
  const format = fileHandle.getFormat();
  console.log(`File format: ${format}`);
  
  // Get tag
  const tag = fileHandle.getTag();
  console.log(`Tag retrieved`);
  
  if (tag) {
    console.log("\nTag information:");
    console.log(`Title: ${tag.title()}`);
    console.log(`Artist: ${tag.artist()}`);
    console.log(`Album: ${tag.album()}`);
    console.log(`Year: ${tag.year()}`);
    console.log(`Track: ${tag.track()}`);
    console.log(`Genre: ${tag.genre()}`);
    console.log(`Comment: ${tag.comment()}`);
    
    // Modify tag
    console.log("\nModifying tag...");
    tag.setTitle("Test Title from Embind");
    tag.setArtist("Embind Artist");
    console.log(`New title: ${tag.title()}`);
    console.log(`New artist: ${tag.artist()}`);
  }
  
  // Get audio properties
  const props = fileHandle.getAudioProperties();
  console.log(`\nAudio properties retrieved`);
  
  if (props) {
    console.log("Audio properties:");
    console.log(`Duration: ${props.lengthInSeconds()} seconds`);
    console.log(`Duration (ms): ${props.lengthInMilliseconds()} ms`);
    console.log(`Bitrate: ${props.bitrate()} kbps`);
    console.log(`Sample rate: ${props.sampleRate()} Hz`);
    console.log(`Channels: ${props.channels()}`);
  }
  
  // Get properties
  console.log("\nGetting all properties...");
  const properties = fileHandle.getProperties();
  console.log("Properties:", properties);
  
  // Test property get/set
  console.log("\nTesting property get/set...");
  fileHandle.setProperty("CUSTOM", "Test Value");
  const customValue = fileHandle.getProperty("CUSTOM");
  console.log(`Custom property: ${customValue}`);
  
  // Clean up - Embind handles cleanup automatically
  console.log("\nTest completed successfully!");
}

test().catch(console.error);
var UPS = require('./index');
var upsName;

function getVoltage() {
  upsData.var(upsName, "output.voltage");
};

var upsData = new UPS(false, false, {username: "test", password: "test", login: true});

upsData.on('connect', function() {
  console.log("Got connect, listing UPS");
  upsData.list();
});

upsData.on('list', function(data){
  console.log("Got list of UPS...");
  console.log(data);
  upsName = data[0].deviceName;
  if (data.length > 0) {
    upsData.vars(upsName);
  }
});

upsData.on('vars', function(data){
  console.log("Got list of UPS vars...");
  console.log(data);
  setInterval(getVoltage, 5000);
});

upsData.on('var', function(data){
  console.log("Got UPS var...");
  console.log(data);
});

upsData.connect();

var UPS = require('./application');

var upsData = new UPS(false, false, {username: "test", password: "test", login: true});

upsData.on('connect', function() {
  console.log("Got connect, listing UPS");
  upsData.list();
});

upsData.on('list', function(data){
  console.log("Got list of UPS...");
  console.log(data);
  if (data.length > 0) {
    upsData.vars(data[0].deviceName);
  }
});

upsData.on('vars', function(data){
  console.log("Got list of UPS vars...");
  console.log(data);
});


upsData.connect();


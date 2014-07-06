var net = require('net'),
    util = require('util'),
    events = require('events').EventEmitter,
    privateEmitter = new events(),
    moduleOpts = {};

String.prototype.unQuote = function() {
  return this.replace(/^["']|["']$/g,"");
};
    
function UPS(host, port, options) {
  var self = this;
  
  events.call(this);
  
  self.opts = typeof options === "object" ? options : {};
  self.opts.host = host || "localhost"; // default to localhost
  self.opts.port = port || 3493; // default port for NUT
  if(!self.opts.hasOwnProperty('username')) {
    self.opts.username = "";
  }
  if(!self.opts.hasOwnProperty('password')) {
    self.opts.username = "";
  }
  if(!self.opts.hasOwnProperty('login')) { //
    self.opts.login = true;
  }
  
  moduleOpts = self.opts;
  
  privateEmitter.on('connect', function() {
    // console.log("Connected in, auto login is: " + moduleOpts.login);
    if(moduleOpts.login === true) {
      process.nextTick(self.login);
    }
  });
  
  privateEmitter.on('logged-in', function() {
    // console.log("Logged in, emitting 'connect'");
    self.emit('connect');
  });
  
  privateEmitter.on('list-complete', function() {
    self.emit('list', deviceList);
  });
  
  privateEmitter.on('vars-complete', function(data) {
    self.emit('vars', data);
  });
}     

util.inherits(UPS, events);

UPS.prototype.connect = function(callback) {
  var autologin = autologin || false;
  // console.time('connecting');
  connection.connect(this.opts.port, this.opts.host);
};

UPS.prototype.login = function(callback) {
  if(sessionState.loggedIn === false) {
    // console.log("Not logged in, sending username");
    process.nextTick(sendUsername);
  } else if("function" === typeof callback) {
    callback = console.log;
    callback({error: "Already logged in"});
  }
};

UPS.prototype.list = function(callback) {
  if(sessionState.loggedIn === true) {
    sendCommand(commandStrings.listUPS);
  } else {
    if("function" === typeof callback) {
      callback = console.log;
      callback({error: "Must login before getting a list of UPS"});
    }
  } 
};

UPS.prototype.vars = function(upsName, callback) {
  if(sessionState.loggedIn === true) {
    if((typeof upsName === "string" && upsName !== "") || deviceList.length > 0) {
      upsName = upsName || deviceList[0].devicename;          
      sendCommand(commandStrings.listVar.replace("%s", upsName));
    } else {
      if("function" === typeof callback) {
        callback = console.log;
        callback({error: "No UPS name was given and no entries were found in the UPS list"});
      }
    }
  } else {
    if("function" === typeof callback) {
      callback = console.log;
      callback({error: "Must login before getting a list of UPS"});
    }
  }  
};

var commandStrings = {
      username: "USERNAME %s", // NUT UPS username
      password: "PASSWORD %s", // NUT UPS password
      listUPS: "LIST UPS",
      listVar: "LIST VAR %s",  // NUT UPS name
      getVar: "GET VAR %s %s", // NUT UPS name, NUT VAR name
      listCmd: "LIST CMD %s",  // NUT UPS name
      commandTerminator: "\n"
    },
    commandHistory = [],
    deviceList = [],
    sessionState = {
        connected: false,
        usernameOk: false,
        passwordOk: false,
        loggedIn: false
    },
    sendCommand = function(command) {
      // console.log(command);
      commandHistory.push(command);
      connection.write(command+commandStrings.commandTerminator);
    },
    processList = function(data) {
      // console.time('process-ups-list');
      // console.log("Processing UPS List response: " + data.toString().replace("\n"," "));
      var dataString = data.toString();
      if (dataString.indexOf("UPS ") !== -1 ) {
        var deviceListRaw = dataString.split("\n");
        for (var i = 0; i < deviceListRaw.length; i++) {
          if(deviceListRaw[i].indexOf("UPS ") === 0) {
            var UPSnameSeparator = deviceListRaw[i][4] == "\"" ? "\"" : " ",
                UPSfirstSeparatorPos = deviceListRaw[i].indexOf(UPSnameSeparator) + 1,
                UPSlastSeparatorPos = deviceListRaw[i].indexOf(UPSnameSeparator, UPSfirstSeparatorPos),
                UPSdeviceName = deviceListRaw[i].slice(UPSfirstSeparatorPos, UPSlastSeparatorPos),
                UPShumanName = deviceListRaw[i].slice(UPSlastSeparatorPos + 1),
                UPSdata = ({
                  deviceName: UPSdeviceName.unQuote(),
                  humanName: UPShumanName.unQuote(),
                  data: []
                });
                
            // console.log(UPSdata);
            deviceList.push(UPSdata);
          }
        }
      }
      if (dataString.indexOf("END LIST") !== -1) {
        privateEmitter.emit('list-complete', deviceList);
      }
      // console.timeEnd('process-ups-list');
    },
    processVars = function(data) {
      // console.time('process-ups-vars');
      console.log("Processing Vars List");
      
      var dataString = data.toString(),
          UPSVarsRaw = dataString.split("\n"),
          UPSName = "",
          dataOffset = 0,
          dataList = [],
          deviceListOffset = false;

      console.log(dataString);
          
      for(var i = 0; i < UPSVarsRaw.length; i++) {
        if (UPSVarsRaw[i].indexOf("VAR") === 0) {
          if (UPSName === "") {
            var separator = UPSVarsRaw[i][4] == "\"" ? "\"" : " ",
                startPos = UPSVarsRaw[i].indexOf(separator) + 1;
              
            dataOffset = UPSVarsRaw[i].indexOf(separator, startPos + 1);
            UPSName = UPSVarsRaw[i].slice(startPos, dataOffset);
          }
          if (dataOffset !== 0) {
            var valueOffset = UPSVarsRaw[i].indexOf(" ", dataOffset + 1);
            dataList.push({
              label: UPSVarsRaw[i].slice(dataOffset + 1, valueOffset),
              value: UPSVarsRaw[i].slice(valueOffset + 1).unQuote()
            });
          }
        }
      }
      for(var i = 0; i < deviceList.length; i++) {
        if(deviceList[i].deviceName === UPSName) {
          deviceList[i].data = dataList.splice(0);
          deviceListOffset = i;
        }
      }
      
      if (dataString.indexOf("END LIST") !== -1) {
        privateEmitter.emit('vars-complete', deviceList[deviceListOffset]);
      }
      // console.timeEnd('process-ups-vars');
    },
    sendUsername = function() {
      // console.log("Username: " + moduleOpts.username);
      sendCommand(commandStrings.username.replace("%s", moduleOpts.username));
    },
    sendPassword = function() {
      // console.log("Password: " + moduleOpts.password);
      sendCommand(commandStrings.password.replace("%s", moduleOpts.password));
    },
    processUsername = function(data) {
      // console.log("Processing Username response: " + data.toString());
      if(sessionState.loggedIn === false) {
        if(sessionState.usernameOk !== true ) {
          if(data.toString().indexOf("OK\n") > -1) {
            sessionState.usernameOk = true;
            process.nextTick(sendPassword);
          } else {
            callback = console.log;
            callback({error: "Username unknown"});
          }
        }
      } else {
        // console.log("sessionStatealready logged in");
      }
    },
    processPassword = function(data) {
      // console.log("Processing Password response: " + data.toString());
      if (sessionState.passwordOk !== true) {
        if(data.toString().indexOf("OK\n") > -1) {
          sessionState.passwordOk = true;
          sessionState.loggedIn = true;
          // process.nextTick(getdeviceList);
          privateEmitter.emit('logged-in');
        } else {
          callback = console.log;
          callback({error: "Password unknown"});
        }
      }

    },
    dataHandler = function(data) {
      var commandHandler;
      // console.log("Command History Length" + commandHistory.length);
      if (commandHistory.length !== 0) {
        var lastCommand = commandHistory[commandHistory.length-1];
        if (lastCommand.indexOf("USERNAME ") === 0) {
          privateEmitter.emit('username-received', data);
        } else if (lastCommand.indexOf("PASSWORD ") === 0) {
          privateEmitter.emit('password-received', data);
        } else if (lastCommand.indexOf("LIST UPS") === 0) {
          privateEmitter.emit('ups-list', data);
        } else if (lastCommand.indexOf("LIST VAR") === 0) {
          privateEmitter.emit('var-list', data);
        }
      }
    },
    logError = function(error) {
      // console.log(JSON.stringify(error));
    },
    connected = function(data) {
      // console.timeEnd('connecting');
      sessionState.connected = true;
      privateEmitter.emit('connect');
    };

privateEmitter.on('username-received', processUsername);
privateEmitter.on('password-received', processPassword);
privateEmitter.on('ups-list', processList);
privateEmitter.on('var-list', processVars);

//Setup socket for connection.    
var connection = new net.Socket();

//Setup connection events.
connection.on('connect', connected);

connection.on('data', dataHandler);

connection.on('error', logError)

connection.on('end', function() {
  sessionState = {
        connected: false,
        usernameOk: false,
        passwordOk: false,
        loggedIn: false
  };
  privateEmitter.emit('disconnected');
});
    
//Exports    
module.exports = UPS;
/*
 * A node Module for interacting with a Network UPS Tool server using it's 
 * network protocol:
 *   http://www.networkupstools.org/docs/developer-guide.chunked/ar01s09.html
 * 
 */

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
  
  privateEmitter.on('error', function(errorData) {
    self.emit('error', errorData);
  });
  
  privateEmitter.on('connect', function() {
    if(moduleOpts.login === true) {
      process.nextTick(self.login);
    }
  });
  
  privateEmitter.on('logged-in', function() {
    self.emit('connect');
  });
  
  privateEmitter.on('list-complete', function() {
    self.emit('list', deviceList);
  });
  
  privateEmitter.on('vars-complete', function(data) {
    self.emit('vars', data);
  });
  
  privateEmitter.on('var-complete', function(data) {
    self.emit('var', data);
  });
}     

util.inherits(UPS, events);

UPS.prototype.connect = function(callback) {
  var autologin = autologin || false;
  connection.connect(this.opts.port, this.opts.host);
};

UPS.prototype.login = function(callback) {
  if(sessionState.loggedIn === false) {
    process.nextTick(sendUsername);
  } else {
    self.emit('error', new Error( "Already logged in"));
  }
};

UPS.prototype.list = function(callback) {
  if(sessionState.loggedIn === true) {
    sendCommand(commandStrings.listUPS);
  } else {
    self.emit('error', new Error( "Must login before getting a list of UPS devices"));
  } 
};

UPS.prototype.vars = function(upsName, callback) {
  if(sessionState.loggedIn === true) {
    if((typeof upsName === "string" && upsName !== "") || deviceList.length > 0) {
      upsName = upsName || deviceList[0].devicename;          
      sendCommand(commandStrings.listVar.replace("%s", upsName));
    } else {
      self.emit('error', new Error("No UPS name was given and no entries were found in the UPS list"));
    }
  } else {
    self.emit('error', new Error("Must login before getting a list of UPS"));
  }  
};

UPS.prototype.var = function(upsName, varName, callback) {
  if(sessionState.loggedIn === true) {
    if(typeof varName === "string" && upsName !== "") {
      if((typeof upsName === "string" && upsName !== "") || deviceList.length > 0) {
        upsName = upsName || deviceList[0].devicename;          
        sendCommand(commandStrings.getVar.replace(commandStrings.tokenRegex, upsName).replace(commandStrings.tokenRegex, varName));
      } else {
        self.emit('error', new Error("No UPS name was given and no entries were found in the UPS list"));
      }
    } else {
      self.emit('error', new Error("No VAR name was given"));
    }
  } else {
    self.emit('error', new Error("Must login before getting a list of UPS"));
  }
};

var commandStrings = {
      username: "USERNAME %s", // NUT UPS username
      password: "PASSWORD %s", // NUT UPS password
      listUPS: "LIST UPS",
      listVar: "LIST VAR %s",  // NUT UPS name
      getVar: "GET VAR %s %s", // NUT UPS name, NUT VAR name
      listCmd: "LIST CMD %s",  // NUT UPS name
      commandTerminator: "\n",
      tokenRegex: /%s/
    },
    commandHistory = [],
    deviceList = [],
    sessionState = {
        connected: false,
        usernameOk: false,
        passwordOk: false,
        loggedIn: false
    },
    deviceIndex = function(element) {
      return (deviceName == element.deviceName);
    },
    sendCommand = function(command) {
      commandHistory.push(command);
      connection.write(command+commandStrings.commandTerminator);
    },
    sendUsername = function() {
      sendCommand(commandStrings.username.replace("%s", moduleOpts.username));
    },
    sendPassword = function() {
      sendCommand(commandStrings.password.replace("%s", moduleOpts.password));
    },
    processUsername = function(data) {
      if(sessionState.loggedIn === false) {
        if(sessionState.usernameOk !== true ) {
          if(data.toString().indexOf("OK\n") > -1) {
            sessionState.usernameOk = true;
            process.nextTick(sendPassword);
          } else if (data.toString().indexOf("ERR") > -1) {
            callback = console.log;
          privateEmitter.emit('error', new Error("Username unknown"));
          } 
        }
      } else {
        privateEmitter.emit('error', new Error("Already logged in"));
      }
    },
    processPassword = function(data) {
      if (sessionState.passwordOk !== true) {
        if (data.toString().indexOf("OK\n") > -1) {
          sessionState.passwordOk = true;
          sessionState.loggedIn = true;
          privateEmitter.emit('logged-in');
        } else if (data.toString().indexOf("ERR") > -1) {
          privateEmitter.emit('error', new Error("Password unknown"));
        }
      }
    },
    processList = function(data) {
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
                
            deviceList.push(UPSdata);
          }
        }
      }
      //check the data buffer captured all of the response before emitting an event
      if (dataString.indexOf("END LIST") !== -1) {
        privateEmitter.emit('list-complete', deviceList);
      }
    },
    processVarData = function(data) {
      var UPSVarsRaw = data.split("\n"),
          UPSName = "",
          dataOffset = 0,
          dataList = {};

      //todo: get UPS name from first line "BEGIN LIST VAR <upsname>"
          
      for(var i = 0; i < UPSVarsRaw.length; i++) {
        if (UPSVarsRaw[i].indexOf("VAR ") === 0) {
          if (UPSName === "") {
            var separator = UPSVarsRaw[i][4] == "\"" ? "\"" : " ",
                startPos = UPSVarsRaw[i].indexOf(separator) + 1;
              
            dataOffset = UPSVarsRaw[i].indexOf(separator, startPos + 1);
            UPSName = UPSVarsRaw[i].slice(startPos, dataOffset);
          }
          if (dataOffset !== 0) {
            var valueOffset = UPSVarsRaw[i].indexOf(" ", dataOffset + 1);
            dataList[UPSVarsRaw[i].slice(dataOffset + 1, valueOffset)] = UPSVarsRaw[i].slice(valueOffset + 1).unQuote();
          }
        }
      }

      return({deviceName: UPSName, deviceProperties: dataList});
    },
    processVars = function(data) {
      var dataString = data.toString(),
          deviceData = processVarData(dataString),
          deviceListOffset = false;      
      
      for(var i = 0; i < deviceList.length; i++) {
        if(deviceList[i].deviceName === deviceData.deviceName) {
          //update all the properties
          deviceList[i].data = deviceData.deviceProperties;
          deviceListOffset = i;
        }
      }
      
      //check the data buffer captured all of the response before emitting an event
      if (dataString.toString().indexOf("END LIST") !== -1) {
        privateEmitter.emit('vars-complete', deviceList[deviceListOffset]);
      }
    },
    processSingleVar = function(data) {
      var dataString = data.toString(),
          deviceData = processVarData(dataString),
          deviceListOffset = false;    
      
      for(var i = 0; i < deviceList.length; i++) {
        if(deviceList[i].deviceName === deviceData.deviceName) {
          var devicePropertyList = Object.getOwnPropertyNames(deviceData.deviceProperties);
          //update only the properties that have been updated
          for(var j = 0; j < devicePropertyList.length; j++) {
            deviceList[i].data[devicePropertyList.j] = deviceData.deviceProperties[devicePropertyList.j];
          }
          deviceListOffset = i;
        }
      }
      
      //check the data buffer captured all of the response before emitting an event
      //if (devicePropertyList) {
        var returnData = deviceList[deviceListOffset];
        returnData.data = deviceData.deviceProperties;
        privateEmitter.emit('vars-complete', returnData);
      //}
    },
    dataHandler = function(data) {
      //We don't know which command the data we've received came from, so we need to look it up.
      var commandHandler;
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
        } else if (lastCommand.indexOf("GET VAR") === 0) {
          privateEmitter.emit('var', data);
        }
      }
    },
    logError = function(error) {
      privateEmitter.emit('error', error);
    },
    connected = function(data) {
      sessionState.connected = true;
      privateEmitter.emit('connect');
    };

privateEmitter.on('username-received', processUsername);
privateEmitter.on('password-received', processPassword);
privateEmitter.on('ups-list', processList);
privateEmitter.on('var-list', processVars);
privateEmitter.on('var', processSingleVar);

//Setup socket for connection.    
var connection = new net.Socket();

//Setup handlers for socket/connection events.
connection.on('connect', connected);

connection.on('data', dataHandler);

connection.on('error', logError);

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
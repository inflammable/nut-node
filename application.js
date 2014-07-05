var net = require('net'),
    eventEmitter = new (require('events').EventEmitter);

module.exports = UPS;

function UPS(host, port, options) {
  this.opts = typeof options === "object" ? options : {};
  this.opts.host = host || "localhost"; // default to localhost
  this.opts.port = port || 3493; // default port for NUT
  if(!this.opts.hasOwnProperty('username')) {
    this.opts.username = "";
  }
  if(!this.opts.hasOwnProperty('password')) {
    this.opts.username = "";
  }
}     
    
String.prototype.unQuote = function() {
  return this.replace(/["']/g,"");
};

var connection = new net.Socket();

connection.on('data', dataHandler);

connection.on('end', function() {
  logInState = {
        usernameOk: false,
        passwordOk: false,
        loggedIn: false
  };
  eventEmitter.emit('disconnected');
});

UPS.prototype.connect = function(callback, autologin) {
  var autologin = autologin || false;
  console.time('connecting');
  connection.connect({username: ups.opts.username, password: ups.opts.password}, function() {
    console.timeEnd('connecting');
    connected = true;
    if(autologin === true) {
      process.nextTick(this.login);
      //todo: handle callback
    }
  });
};

UPS.prototype.login = function(callback) {
  if(logInState.loggedIn === false) {
    var command;
    if(logInState.usernameOk !== true) {
      command = strings.username.replace("%s", loginDetails.username);
    } else if(logInState.passwordOk !== true) {
      command = strings.password.replace("%s", loginDetails.password);
    }
    sendCommand(command);
    //todo: handle callback
  } else if(callback) {
    callback({error: "Already logged in"});
  }
};

UPS.prototype.list = function(callback) {
  if(logInState.loggedIn === true) {
    sendCommand(strings.listUPS);
  } else {
    if(callback) {
      callback({error: "Must login before getting a list of UPS"});
    }
  } 
};

UPS.prototype.getVars = function(upsName, callback) {
  if(logInState.loggedIn === true) {
    if((typeof upsName === "string" && upsName !== "") || UPSList.length > 0) {
      upsName = upsName || UPSList[0].devicename;          
      sendCommand(strings.listVar.replace("%s", upsName));
    } else {
      if(callback) {
        callback({error: "No UPS name was given and no entries were found in the UPS list"});
      }
    }
  } else {
    if(callback) {
      callback({error: "Must login before getting a list of UPS"});
    }
  }  
};

var strings = {
      username: "USERNAME %s", // NUT UPS username
      password: "PASSWORD %s", // NUT UPS password
      listUPS: "LIST UPS",
      listVar: "LIST VAR %s",  // NUT UPS name
      getVar: "GET VAR %s %s", // NUT UPS name, NUT VAR name
      listCmd: "LIST CMD %s",  // NUT UPS name
      commandTerminator: "\n"
    },
    commandHistory = [],
    UPSList = [],
    connected = false,
    logInState = {
        usernameOk: false,
        passwordOk: false,
        loggedIn: false
    },
    sendCommand = function(command) {
      //console.log(command);
      commandHistory.push(command);
      connection.write(command+strings.commandTerminator);
    },
    processUPSList = function(data) {
      console.time('process-ups-list');
      var UPSListRaw = data.toString().split("\n");
      for (var i = 0; i < UPSListRaw.length; i++) {
        if(UPSListRaw[i].indexOf("UPS ") === 0) {
          var UPSnameSeparator = UPSListRaw[i][4] == "\"" ? "\"" : " ",
              UPSfirstSeparatorPos = UPSListRaw[i].indexOf(UPSnameSeparator) + 1,
              UPSlastSeparatorPos = UPSListRaw[i].indexOf(UPSnameSeparator, UPSfirstSeparatorPos),
              UPSdeviceName = UPSListRaw[i].slice(UPSfirstSeparatorPos, UPSlastSeparatorPos),
              UPShumanName = UPSListRaw[i].slice(UPSlastSeparatorPos + 1),
              UPSdata = ({
                deviceName: UPSdeviceName.unQuote(),
                humanName: UPShumanName.unQuote(),
                data: []
              });
          UPSList.push(UPSdata);
        }
      }
      console.timeEnd('process-ups-list');
      //if(UPSList.length > 0) {
        //console.log(JSON.stringify(UPSList));
        //process.nextTick(getUPSVars);
      //}
    },
    processUPSVars = function(data) {
      console.time('process-ups-vars');
      var UPSVarsRaw = data.toString().split("\n"),
          UPSName = "",
          dataOffset = 0,
          dataList = [];

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
      for(var i = 0; i < UPSList.length; i++) {
        if(UPSList[i].deviceName === UPSName) {
          UPSList[i].data = dataList.splice(0);
        }
      }
      console.timeEnd('process-ups-vars');
      console.log(JSON.stringify(UPSList));
      connect.end();
    },
    processLogin = function(data) {
      //console.log("Processing Login");
      if(logInState.loggedIn === false) {
        if(logInState.usernameOk !== true ) {
          if(data.toString().indexOf("OK\n") > -1) {
            logInState.usernameOk = true;
            process.nextTick(logIn);
          }
        } else if (logInState.passwordOk !== true) {
          if(data.toString().indexOf("OK\n") > -1) {
            logInState.passwordOk = true;
            logInState.loggedIn = true;
       	    // process.nextTick(getUPSList);
            eventEmitter.emit('logged-in');
          }
        }
      } else {
	      //console.log("logInState already logged in");
      }
    },
    dataHandler = function(data) {
      var commandHandler;
      //console.log("Command History Length" + commandHistory.length);
      if (commandHistory.length !== 0) {
        var lastCommand = commandHistory[commandHistory.length-1];
        if (lastCommand.indexOf("USERNAME ") === 0) {
          eventEmitter.emit('username-received', data);
        } else if (lastCommand.indexOf("PASSWORD ") === 0) {
          eventEmitter.emit('password-received', data);
        } else if (lastCommand.indexOf("LIST UPS") === 0) {
          eventEmitter.emit('ups-list', data);
        } else if (lastCommand.indexOf("LIST VAR") === 0) {
          eventEmitter.emit('var-list', data);
        }
      }
    };
    

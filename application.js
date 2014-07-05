var net = require('net');

var params = {
  host: "localhost",
  port: 3493 //default port for NUT
};

String.prototype.unQuote = function() {
  return this.replace(/["']/g,"");
}

var loginDetails = {
      username: "test",
      password: "test"
    },
    strings = {
      username: "USERNAME %s", // usename
      password: "PASSWORD %s", // password
      listUPS: "LIST UPS",
      listVar: "LIST VAR %s", // ups name
      getVar: "GET VAR %s %s", // ups name, var name
      listCmd: "LIST CMD %s", // ups name
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
      connect.write(command+strings.commandTerminator);
    },
    logIn = function() {
      if(logInState.loggedIn === false) {
        if(logInState.usernameOk !== true) {
          var command = strings.username.replace("%s", loginDetails.username);
        } else if(logInState.passwordOk !== true) {
          var command = strings.password.replace("%s", loginDetails.password);
        }
        sendCommand(command);
      } else {
        //console.log("Already logged in");
      }
    },
    getUPSList = function() {
      sendCommand(strings.listUPS);
    },
    processUPSList = function(data) {
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
      if(UPSList.length > 0) {
        //console.log(JSON.stringify(UPSList));
        getUPSVars();
      }
    },
    getUPSVars = function() {
      for (var i = 0; i < UPSList.length; i++) {
        sendCommand(strings.listVar.replace("%s", UPSList[i].deviceName));
      }
    },
    processUPSVars = function(data) {
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
       	    process.nextTick(getUPSList);
          }
        }
      } else {
	      //console.log("logInState already logged in");
      }
    },
    dataHandler = function(data) {
      var commandHandler;
      //console.log("Command History Length" + commandHistory.length);
      if (commandHistory.length === 0) {
        commandHandler = logIn;
      } else {
        var lastCommand = commandHistory[commandHistory.length-1];
        if (lastCommand.indexOf("USERNAME ") === 0) {
          commandHandler = processLogin;
        } else if (lastCommand.indexOf("PASSWORD ") === 0) {
          commandHandler = processLogin;
        } else if (lastCommand.indexOf("LIST UPS") === 0) {
          commandHandler = processUPSList;
        } else if (lastCommand.indexOf("LIST VAR") === 0) {
          commandHandler = processUPSVars;
        }
      }
      if (typeof commandHandler === "function") {
        commandHandler(data);
      } else {
        //console.log(typeof commandHandler);
      }
    },
    connect = new net.Socket();

connect.on('data', dataHandler);

connect.on('end', function() {
  //console.log('client disconnected');
  //console.log(commandHistory.toString());
});

connect.connect(params, function() {
  connected = true;
  process.nextTick(logIn);
});


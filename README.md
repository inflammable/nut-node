nut-node
========

A rough node Module for interacting with a Network UPS Tool server which implements LIST UPS, LIST VARS and GET VARS and returns UPS information in JSON.

##Usage
See `example.js` for working example.

##Output

###UPS LIST
```
[{ deviceName: 'cyberpower', humanName: 'NAS UPS', data: [] }]
```

###LIST VARS
```
{
  deviceName: 'cyberpower',
  humanName: 'NAS UPS',
  data: {
    'battery.charge': '100',
    'battery.charge.low': '10',
    'battery.charge.warning': '20',
    'battery.mfr.date': 'CPS',
    'battery.runtime': '2184',
    'battery.runtime.low': '300',
    'battery.type': 'PbAcid',
    'battery.voltage': '8.5',
    'battery.voltage.nominal': '12',
    'device.mfr': 'CPS',
    'device.model': 'Value600EIGP',
    'device.type': 'ups',
    'driver.name': 'usbhid-ups',
    'driver.parameter.pollfreq': '30',
    'driver.parameter.pollinterval': '2',
    'driver.parameter.port': 'auto',
    'driver.parameter.vendorid': '0764',
    'driver.version': '2.6.4',
    'driver.version.data': 'CyberPower HID 0.3',
    'driver.version.internal': '0.37',
    'input.transfer.high': '0',
    'input.transfer.low': '0',
    'input.voltage': '240.0',
    'input.voltage.nominal': '230',
    'output.voltage': '240.0',
    'ups.beeper.status': 'enabled',
    'ups.delay.shutdown': '20',
    'ups.delay.start': '30',
    'ups.load': '9',
    'ups.mfr': 'CPS',
    'ups.model': 'Value600EIGP',
    'ups.productid': '0501',
    'ups.realpower.nominal': '360',
    'ups.status': 'OL',
    'ups.test.result': 'Aborted',
    'ups.timer.shutdown': '-60',
    'ups.timer.start': '-60',
    'ups.vendorid': '0764'
  }
}
```

###GET VAR
```
{
  deviceName: 'cyberpower',
  humanName: 'NAS UPS',
  data: {
    'output.voltage': '242.0'
  }
}
```

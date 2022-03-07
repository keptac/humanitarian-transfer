//var SimpleBank = artifacts.require("./SimpleBank.sol");
var HumanitarianTransfer = artifacts.require("./HumanitarianTransfer.sol");

module.exports = function(deployer) {
  //deployer.deploy(SimpleBank);
  deployer.deploy(HumanitarianTransfer);
};

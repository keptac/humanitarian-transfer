let BN = web3.utils.BN;
let HumanitarianTransfer = artifacts.require("HumanitarianTransfer");
let { catchRevert } = require("./exceptionsHelpers.js");
const { items: RequestDonationStruct, isDefined, isPayable, isType } = require("./ast-helper");

contract("HumanitarianTransfer", function (accounts) {
  const [_owner, unicefSuspenseAccount, partnerAccount, merchantAccount] = accounts;
  const emptyAddress = "0x0000000000000000000000000000000000000000";

  const amount = "1000";
  const excessAmount = "2000";
  const implementingPartner = "AKDN";

  let instance;

  beforeEach(async () => {
    instance = await HumanitarianTransfer.new();
  });

  describe("Variables", () => {
    it("should have an owner", async () => {
      assert.equal(typeof instance.owner, 'function', "the contract has no owner");
    });

    it("should have an donationIdCount", async () => {
      assert.equal(typeof instance.donationIdCount, 'function', "the contract has no donationIdCount");
    });

    describe("enum State", () => {
      let enumState;
      before(() => {
        enumState = HumanitarianTransfer.enums.State;
        assert(
          enumState,
          "The contract should define an Enum called State"
        );
      });

      it("should define `Pending`", () => {
        assert(
          enumState.hasOwnProperty('Pending'),
          "The enum does not have a `Pending` value"
        );
      });

      it("should define `Approved`", () => {
        assert(
          enumState.hasOwnProperty('Approved'),
          "The enum does not have a `Approved` value"
        );
      });

      it("should define `VoucherIsued`", () => {
        assert(
          enumState.hasOwnProperty('VoucherIsued'),
          "The enum does not have a `VoucherIsued` value"
        );
      });

    })

    describe("RequestDonation struct", () => {
      let subjectStruct;

      before(() => {
        subjectStruct = RequestDonationStruct(HumanitarianTransfer);
        assert(
          subjectStruct !== null, 
          "The contract should define an `RequestDonation Struct`"
        );
      });

      it("should have a `implementingPartner`", () => {
        assert(
          isDefined(subjectStruct)("implementingPartner"), 
          "Struct RequestDonation should have a `implementingPartner` member"
        );
        assert(
          isType(subjectStruct)("implementingPartner")("string"), 
          "`implementingPartner` should be of type `string`"
        );
      });

      it("should have a `donationId`", () => {
        assert(
          isDefined(subjectStruct)("donationId"), 
          "Struct RequestDonation should have a `donationId` member"
        );
        assert(
          isType(subjectStruct)("donationId")("uint"), 
          "`donationId` should be of type `uint`"
        );
      });

      it("should have a `amount`", () => {
        assert(
          isDefined(subjectStruct)("amount"), 
          "Struct RequestDonation should have a `amount` member"
        );
        assert(
          isType(subjectStruct)("amount")("uint"), 
          "`amount` should be of type `uint`"
        );
      });

      it("should have a `state`", () => {
        assert(
          isDefined(subjectStruct)("state"), 
          "Struct RequestDonation should have a `state` member"
        );
        assert(
          isType(subjectStruct)("state")("State"), 
          "`state` should be of type `State`"
        );
      });
    });
  });

  describe("Use cases", () => {
    it("should add a donation with the provided implementingPartner and amount", async () => {
      await instance.requestDonations(implementingPartner, amount, partnerAccount, { from: unicefSuspenseAccount });

      const result = await instance.fetchDonations.call(0);

      console.log(result[0]);

      assert.equal(
        result[0],
        implementingPartner,
        "the implementingPartner of the last added donation does not match the expected value",
      );
      assert.equal(
        result[2].toString(10),
        amount,
        "the amount of the last added donation does not match the expected value",
      );
      assert.equal(
        result[3].toString(10),
        HumanitarianTransfer.State.Pending,
        'the state of the donation should be "Pending"',
      );
      assert.equal(
        result[4],
        unicefSuspenseAccount,
        "the address adding the donation should be listed as UNICEF account",
      );
      assert.equal(
        result[5],
        partnerAccount,
        "the beneficiary address does not match the expected address.",
      );
    });

    it("should emit a LogRequestInitiliazed event when an donation is added", async () => {
      let eventEmitted = false;
      const tx = await instance.requestDonations(implementingPartner, amount, { from: unicefSuspenseAccount });

      if (tx.logs[0].event == "LogRequestInitiliazed") {
        eventEmitted = true;
      }

      assert.equal(
        eventEmitted,
        true,
        "adding an donation should emit a For Sale event",
      );
    });

    it("should allow someone to issue a Approve a donaton and update state accordingly", async () => {
      await instance.requestDonations(implementingPartner, amount, { from: unicefSuspenseAccount });
      var aliceBalanceBefore = await web3.eth.getBalance(unicefSuspenseAccount);
      var bobBalanceBefore = await web3.eth.getBalance(partnerAccount);

      await instance.approveRequest(0, 'Kelvin Chelenje', { from: partnerAccount, value: excessAmount });

      var aliceBalanceAfter = await web3.eth.getBalance(unicefSuspenseAccount);
      var bobBalanceAfter = await web3.eth.getBalance(partnerAccount);

      const result = await instance.fetchDonations.call(0);

      assert.equal(
        result[3].toString(10),
        HumanitarianTransfer.State.Approved,
        'the state of the donation should be "Approved"',
      );

      assert.equal(
        result[5],
        partnerAccount,
        "the beneficiary address should be set partnerAccount when he purchases an donation",
      );

      assert.equal(
        new BN(aliceBalanceAfter).toString(),
        new BN(aliceBalanceBefore).add(new BN(amount)).toString(),
        "unicefSuspenseAccount's balance should be increased by the amount of the donation",
      );

      assert.isBelow(
        Number(bobBalanceAfter),
        Number(new BN(bobBalanceBefore).sub(new BN(amount))),
        "partnerAccount's balance should be reduced by more than the amount of the donation (including gas costs)",
      );
    });


    it("should emit LogApproved event when and donation is approved", async () => {
      var eventEmitted = false;

      await instance.requestDonations(implementingPartner, amount, { from: unicefSuspenseAccount });
      const tx = await instance.approveRequest(0, 'Kelvin Chelenje', { from: partnerAccount, value: excessAmount });

      if (tx.logs[0].event == "LogApproved") {
        eventEmitted = true;
      }

      assert.equal(eventEmitted, true, "adding an donation should emit a Approved event");
    });

    it("should revert when someone that is not the seller tries to call issueVouchers()", async () => {
      await instance.requestDonations(implementingPartner, amount, { from: unicefSuspenseAccount });
      await instance.approveRequest(0, 'Kelvin Chelenje', { from: partnerAccount, value: amount });
      await catchRevert(instance.issueVouchers(0, { from: partnerAccount }));
    });

    it("should allow the seller to mark the donation as issued", async () => {
      await instance.requestDonations(implementingPartner, amount, { from: unicefSuspenseAccount });
      await instance.approveRequest(0, 'Kelvin Chelenje', { from: partnerAccount, value: excessAmount });
      await instance.issueVouchers(0, { from: unicefSuspenseAccount });

      const result = await instance.fetchDonations.call(0);

      assert.equal(
        result[3].toString(10),
        HumanitarianTransfer.State.VoucherIsued,
        'the state of the donation should be "VoucherIsued"',
      );
    });

    it("should emit a LogVoucherIssued event when an donation is issued", async () => {
      var eventEmitted = false;

      await instance.requestDonations(implementingPartner, amount, { from: unicefSuspenseAccount });
      await instance.approveRequest(0, 'Kelvin Chelenje', { from: partnerAccount, value: excessAmount });
      const tx = await instance.issueVouchers(0, { from: unicefSuspenseAccount });

      if (tx.logs[0].event == "LogVoucherIssued") {
        eventEmitted = true;
      }

      assert.equal(
        eventEmitted,
        true,
        "adding an donation should emit a VoucherIsued event",
      );
    });

    it("should allow the beneficiary to mark the donation as used by beneficiary", async () => {
      await instance.requestDonations(implementingPartner, amount, { from: unicefSuspenseAccount });
      await instance.approveRequest(0, 'Kelvin Chelenje', { from: partnerAccount, value: excessAmount });
      await instance.issueVouchers(0, { from: unicefSuspenseAccount });
      await instance.useVoucher(0, { from: partnerAccount });

      const result = await instance.fetchDonations.call(0);

      assert.equal(
        result[3].toString(10),
        HumanitarianTransfer.State.Received,
        'the state of the donation should be "Received"',
      );
    });

    it("should revert if an address other than the beneficiary calls useVoucher()", async () => {
      await instance.requestDonations(implementingPartner, amount, { from: unicefSuspenseAccount });
      await instance.approveRequest(0, 'Kelvin Chelenje', { from: partnerAccount, value: excessAmount });
      await instance.issueVouchers(0, { from: unicefSuspenseAccount });

      await catchRevert(instance.useVoucher(0, { from: unicefSuspenseAccount }));
    });

    it("should emit a LogReceived event when an donation is received", async () => {
      var eventEmitted = false;

      await instance.requestDonations(implementingPartner, amount, { from: unicefSuspenseAccount });
      await instance.approveRequest(0, 'Kelvin Chelenje', { from: partnerAccount, value: excessAmount });
      await instance.issueVouchers(0, { from: unicefSuspenseAccount });
      const tx = await instance.useVoucher(0, { from: partnerAccount });

      if (tx.logs[0].event == "LogReceived") {
        eventEmitted = true;
      }

      assert.equal(
        eventEmitted,
        true,
        "adding an donation should emit a VoucherIsued event",
      );
    });

  });

});

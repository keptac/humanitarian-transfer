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
       const tx = await instance.requestDonations(implementingPartner, amount, partnerAccount, { from: unicefSuspenseAccount });

      if (tx.logs[0].event == "LogRequestInitiliazed") {
        eventEmitted = true;
      }

      assert.equal(
        eventEmitted,
        true,
        "adding an donation should emit a Pending event",
      );
    });

    it("should allow someone to Approve a donation request and update state accordingly", async () => {
      await instance.requestDonations(implementingPartner, amount, partnerAccount, { from: unicefSuspenseAccount });
      var unicefSuspenseAccountBalanceBefore = await web3.eth.getBalance(unicefSuspenseAccount);
      var partnerAccountBalanceBefore = await web3.eth.getBalance(partnerAccount);

      await instance.approveRequest(0, 'Kelvin Chelenje', { from: partnerAccount, value: excessAmount });

      var unicefSuspenseAccountBalanceAfter = await web3.eth.getBalance(unicefSuspenseAccount);
      var partnerAccountBalanceAfter = await web3.eth.getBalance(partnerAccount);

      const result = await instance.fetchDonations.call(0);

      assert.equal(
        result[3].toString(10),
        HumanitarianTransfer.State.Approved,
        'the state of the donation should be "Approved"',
      );

      assert.equal(
        result[5],
        partnerAccount,
        "the beneficiary address should be set partnerAccount when receives a donation",
      );

      assert.isBelow(
        Number(partnerAccountBalanceAfter),
        Number(new BN(partnerAccountBalanceBefore).add(new BN(amount))),
        "partnerAccount's balance should be increased by more than the amount of the donation",
      );

    });


    it("should emit LogApproved event when and donation is approved", async () => {
      var eventEmitted = false;

      await instance.requestDonations(implementingPartner, amount, partnerAccount, { from: unicefSuspenseAccount });
      const tx = await instance.approveRequest(0, 'Kelvin Chelenje', { from: partnerAccount, value: excessAmount });

      if (tx.logs[0].event == "LogApproved") {
        eventEmitted = true;
      }

      assert.equal(eventEmitted, true, "adding an donation should emit a Approved event");
    });

    it("should allow the Partner to mark the donation as issued", async () => {
      await instance.requestDonations(implementingPartner, amount, partnerAccount, { from: unicefSuspenseAccount });
      await instance.approveRequest(0, 'Kelvin Chelenje', { from: partnerAccount, value: excessAmount });
      await instance.issueVoucher(0, 'Keith Chelenje',200);

      const result = await instance.fetchVouchers.call(0);
      assert.equal(
        result[5].toString(10),
        HumanitarianTransfer.State.VoucherIsued,
        'the state of the donation should be "VoucherIsued"',
      );

    });

    it("should emit a LogVoucherIssued event when an donation is issued", async () => {
      var eventEmitted = false;
      await instance.requestDonations(implementingPartner, amount, partnerAccount, { from: unicefSuspenseAccount });
      await instance.approveRequest(0, 'Kelvin Chelenje', { from: partnerAccount, value: excessAmount });
      const tx = await instance.issueVoucher(0, 'Keith Chelenje',200);

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
      await instance.requestDonations(implementingPartner, amount, partnerAccount, { from: unicefSuspenseAccount });
      await instance.approveRequest(0, 'Kelvin Chelenje', { from: partnerAccount, value: excessAmount });
      await instance.issueVoucher(0, 'Keith Chelenje',200);
      await instance.useVoucher(0, 'Keith Chelenje',merchantAccount);

      const result = await instance.fetchVouchers.call(0);

      assert.equal(
        result[5].toString(10),
        HumanitarianTransfer.State.Used,
        'the state of the donation should be "Used"',
      );
      assert.equal(
        result[1].toString(10),
        "Keith Chelenje",
        'Merchant name should be Keith Chelenje',
      );
    });

    it("should emit a VoucherRedeemed event when an donation is received", async () => {
      var eventEmitted = false;

      await instance.requestDonations(implementingPartner, amount, partnerAccount, { from: unicefSuspenseAccount });
      await instance.approveRequest(0, 'Kelvin Chelenje', { from: partnerAccount, value: excessAmount });
      await instance.issueVoucher(0, 'Keith Chelenje',200);
      await instance.useVoucher(0, 'Keith Chelenje',merchantAccount);
      const tx = await instance.redeemVoucher(0);

      if (tx.logs[0].event == "VoucherRedeemed") {
        eventEmitted = true;
      }

      assert.equal(
        tx.logs[0].args[1],
        "Keith Chelenje",
        "The redeemer should be Keith Chelenje",
      );

      assert.equal(
        eventEmitted,
        true,
        "adding an donation should emit a VoucherRedeemed event",
      );
    });
  });
});

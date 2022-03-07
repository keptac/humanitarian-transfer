// SPDX-License-Identifier: MIT
pragma solidity >=0.5.16 <0.9.0;

/// @title HumanitarianTransfer
/// @author Kelvin Chelenje
/// @dev This contract is to request funds from Unicef and disburse the received funds to beneficiaries as vouchers.
/// The vouchers can later be redeemed by merchants when the beneficiaries purchase using the vouchers. Includes the tests

contract HumanitarianTransfer {
  address public owner;
  uint public donationIdCount;
  uint public voucherIdCount;
  mapping (uint => RequestDonation) public donations ;
  mapping (uint => Voucher) public vouchers ;
  mapping (address => uint) public merchantWalletBalance ;
  
  /// @notice These are states that describe the progress of each voucher or funds issued.
  enum State{ Pending, Approved, Rejected, VoucherIsued, Used, Redeemed }

  /// @notice This is a struct to represent the funds provided by	UNICEF initially.  
  struct RequestDonation{
    string implementingPartner;
    uint donationId; 
    uint amount;
    uint donationBalance;
    uint vouchersCount;
    State state;
    address payable unicefSuspenseAccount;
    address payable partnerAccount;
  }

    /// @notice This is a struct to voucher from IP.  the Issuer name is the IP
    struct Voucher{
      string issuerName;
      string beneficiaryName;
      uint donationId; 
      uint voucherId; 
      uint amount;
      State state;
      address payable partnerAccount;
      address payable merchantAccount;
    }

  event LogRequestInitiliazed(uint donationId, string implementationPartner, uint amount);
  event LogApproved(uint donationId, string approver);
  event LogVoucherIssued(uint voucherIdCount, string beneficiaryname);
  event LogUsed(uint voucherId);
  event LogRedeemd(uint voucherId);

  modifier isOwner(){
    require(msg.sender == owner);
    _;
  }

  modifier verifyCaller (address _address) { 
    require (msg.sender == _address); 
    _;
  }

  modifier paidEnough(uint _price) { 
    require(msg.value >= _price); 
    _;
  }

  modifier checkValue(uint _donationId) {
    _;
    uint _amount = donations[_donationId].amount;
    uint amountToRefund = msg.value - _amount;
    donations[_donationId].unicefSuspenseAccount.transfer(amountToRefund);
  }

  modifier approval(uint _donationId) {
    require(donations[_donationId].amount>0 && donations[_donationId].state == State.Pending);
    _;

  }
  modifier approved(uint _donationId){
    require(donations[_donationId].state == State.Approved);
    _;
  }

  modifier checkVoucherLimits(uint _donationId, uint _amount) {
    require(donations[_donationId].donationBalance - _amount>=0);
    _;
  }

  constructor() {
    owner = msg.sender;
    donationIdCount = 0;
    voucherIdCount = 0;
  }

    /// @notice Called when partners are requesting for donations from UNICEF. Initial state is pending.
    /// @param _implementingPartnerName is the name of the Implementing Partner (IP) requesting funds.
    /// @param _amount is the amount being requested for.
    /// @param _partnerAccount is the account to which the funds are to be disbursed.
    /// @dev Donation balance is the donation running balance useful when making fractional vouchers from he main funds donated. 
    /// @dev I did not use the msg.sender as the partner account incase the partner has a seperate account to the funds into
  function requestDonations(string memory _implementingPartnerName, uint _amount, address _partnerAccount) public returns (bool) {
    donations[donationIdCount] = RequestDonation({
      implementingPartner: _implementingPartnerName, 
      donationId: donationIdCount, 
      amount: _amount, 
      donationBalance: _amount,
      vouchersCount: 0,
      state: State.Pending, 
      unicefSuspenseAccount: payable(msg.sender),
      partnerAccount: payable(_partnerAccount)
    });
    
    donationIdCount ++;

    emit LogRequestInitiliazed(donationIdCount,_implementingPartnerName, _amount );
    return true;
  }

    /// @notice Approve request and transfers funds to IP provided and verified account
    /// @param donationId the id for the donation to be approved you want to withdraw
    /// @param approver the Unicef individual who will have approved the donation
    /// @dev refunds excess any funds to the unicef suspence account. 
  function approveRequest(uint donationId, string memory approver) public payable approval(donationId) checkValue(donationId){
    donations[donationId].partnerAccount.transfer(donations[donationId].amount);
    donations[donationId].state = State.Approved;
    emit LogApproved(donationId, approver);
  }

    /// @notice The beneficiaries are not given money but rather are issued a voucher to use 
    /* when purchasing to verified merchants. Each voucher is a fraction of the total donation and the
     * number of total fractions is incremented per each issuance 
     */
    /// @param _beneficiaryName is the name of the Beneficiaty given the voucher
    /// @param _amount is the worth of the voucher issued. 
    /// @dev checks if the donation further breakdown is still valid. That is the account still funded (current balance - voucher worth).
    /// @dev the merchant account is the same as the partner accont because the voucher has not been used yet.
    function issueVoucher(uint donationId, string memory _beneficiaryName, uint _amount) public approved(donationId) checkVoucherLimits(donationId, _amount) {
      vouchers[voucherIdCount] = Voucher({
        issuerName: donations[donationId].implementingPartner, 
        beneficiaryName: _beneficiaryName,
        donationId: donationId, 
        voucherId: voucherIdCount,
        amount: _amount, 
        state: State.VoucherIsued, 
        partnerAccount: payable(msg.sender),
        merchantAccount: payable(msg.sender)
      });

      donations[donationId].donationBalance = donations[donationId].donationBalance - _amount;
      donations[donationId].vouchersCount = donations[donationId].vouchersCount++;
      
      voucherIdCount ++;
      emit LogVoucherIssued(voucherIdCount,_beneficiaryName );
    }

    /// @notice the beneficiary buys using their given voucher id to merchant. this transfers the voucher to merchant but no money is disbursed yet.
    /// @param voucherId is the voucher id
    /// @param _merchantName is the name of the merchant receiving the payment
    /// @param _merchantAccount is the merchant account number receiving the payment
    /// @dev money is only transfered on redeem
    function useVoucher(uint voucherId, string memory _merchantName, address _merchantAccount) public{
      require(vouchers[voucherId].state == State.VoucherIsued);
      vouchers[voucherId].beneficiaryName = _merchantName;
      vouchers[voucherId].merchantAccount = payable(_merchantAccount);
      vouchers[voucherId].state = State.Used;
      emit LogUsed(voucherId);
    }

    /// @notice reimburses the redeemed amount into merchant account from the IP acount
    /// @param voucherId is the voucher id
    /// @dev needs improvement on transferig money from IP account to Merchant account.
    function redeemVoucher(uint voucherId) public{
      require(vouchers[voucherId].state == State.Used);

      vouchers[voucherId].merchantAccount = payable(msg.sender);
      merchantWalletBalance[vouchers[voucherId].merchantAccount] +=  vouchers[voucherId].amount;
      donations[vouchers[voucherId].donationId].amount -=  vouchers[voucherId].amount;

      vouchers[voucherId].merchantAccount.transfer(vouchers[voucherId].amount); //Use trnasfer from
      
      vouchers[voucherId].state = State.Redeemed;
      emit LogRedeemd(voucherId);
    }

   function fetchDonations(uint _donationId) public view  
     returns (string memory implementingPartner, uint donationId, uint amount, State state, address unicefSuspenseAccount, address partnerAccount)  
   { 
     implementingPartner = donations[_donationId].implementingPartner; 
     donationId = donations[_donationId].donationId; 
     amount = donations[_donationId].amount; 
     state = donations[_donationId].state; 
     unicefSuspenseAccount = donations[_donationId].unicefSuspenseAccount; 
     partnerAccount = donations[_donationId].partnerAccount; 
     return (implementingPartner, donationId, amount, state, unicefSuspenseAccount, partnerAccount); 
   } 
}

// SPDX-License-Identifier: MIT
pragma solidity >=0.5.16 <0.9.0;

contract SupplyChain {

  // <owner>
  address public owner = msg.sender;

  // <skuCount>
  uint public skuCount;
  // <items mapping>
  mapping (uint => Item) public items ;

  // <enum State: ForSale, Sold, Shipped, Received>
  enum State{ ForSale, Sold, Shipped, Received }

  // <struct Item: name, sku, price, state, seller, and buyer>
  struct Item{
    string name;
    uint sku; 
    uint price;
    State state;
    address payable seller;
    address payable buyer;
  }

  event LogForSale(uint sku);
  event LogSold(uint sku);
  event LogShipped(uint sku);
  event LogReceived(uint sku);

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

  modifier checkValue(uint _sku) {
    _;
    uint _price = items[_sku].price;
    uint amountToRefund = msg.value - _price;
    items[_sku].buyer.transfer(amountToRefund);
  }

  modifier forSale(uint _sku) {
    require(items[_sku].price>0 && items[_sku].state == State.ForSale);
    _;

  }
  modifier sold(uint _sku){
    require(items[_sku].state == State.Sold);
    _;
  }
  modifier shipped(uint _sku) {
    require(items[_sku].state == State.Shipped);
    _;
  }

  modifier received(uint _sku){
    require(items[_sku].state == State.Received);
    _;
  }

  constructor() public {
    owner = msg.sender;
    skuCount = 0;
  }

  function addItem(string memory _name, uint _price) public returns (bool) {
    Item[] memory products = new Item[](7);
    products[skuCount] = Item(_name, skuCount, _price, State.ForSale, payable(msg.sender), payable(address(0)));
    
    skuCount ++;

    emit LogForSale(skuCount);
    return true;
  }

  function buyItem(uint sku) public payable forSale(sku) paidEnough(items[sku].price) checkValue(sku){
    items[sku].buyer = payable(msg.sender);
    items[sku].seller.transfer(items[sku].price);
    items[sku].state = State.Sold;
    emit LogSold(sku);
  }
  function shipItem(uint sku) public sold(sku) verifyCaller(items[sku].seller) {
    items[sku].state = State.Shipped;
    emit LogShipped(sku);
  }

  function receiveItem(uint sku) public  shipped(sku) verifyCaller(items[sku].seller){
    Item storage product = items[sku];

    product.state = State.Received;
    emit LogReceived(sku);
  }

  // Uncomment the following code block. it is needed to run tests
   function fetchItem(uint _sku) public view  
     returns (string memory name, uint sku, uint price, uint state, address seller, address buyer)  
   { 
     name = items[_sku].name; 
     sku = items[_sku].sku; 
     price = items[_sku].price; 
     state = uint(items[_sku].state); 
     seller = items[_sku].seller; 
     buyer = items[_sku].buyer; 
     return (name, sku, price, state, seller, buyer); 
   } 
}

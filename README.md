# Hellium Three Token and Staking contracts

This project contains smart contracts for both the Hellium Three community token as well as an ERC721 Staking contract,
which allows users to earn rewards for assets that they stake to the contract.

## Get Started

Install the dependencies:

```
npm install --save
```

## Testing

### Basic Test

```
npm run test
```

> Note if this is the first time running a test, it may fail since the types have not been generated. Simply re-execute the test and try again if you run into this issue.

### Test Code Coverage

```
npm run test:coverage
```

Navigate to `coverage/index.html` and open it in your browser.

### Test Gas Usage

> This requires a Coin Marketcap API key to be set in your `.env` file.
> You can create one for free at [coinmarketcap.com](https://coinmarketcap.com/api/)

```
npm run test:gas
```

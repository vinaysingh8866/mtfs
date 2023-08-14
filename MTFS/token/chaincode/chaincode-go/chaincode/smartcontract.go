package chaincode

import (
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

type Token struct {
	contractapi.Contract
}

const (
	balancePrefix   = "balance"
	allowancePrefix = "allowance"
	nameKey         = "name"
	symbolKey       = "symbol"
	decimalsKey     = "decimals"
	totalSupplyKey  = "totalSupply"
)

func (t *Token) InitLedger(ctx contractapi.TransactionContextInterface, name string, symbol string, decimals string) error {
	nameBytes, _ := ctx.GetStub().GetState(nameKey)

	if nameBytes != nil {
		return fmt.Errorf("Contract is already initialized")
	}

	ctx.GetStub().PutState(nameKey, []byte(name))
	ctx.GetStub().PutState(symbolKey, []byte(symbol))
	ctx.GetStub().PutState(decimalsKey, []byte(decimals))

	return nil
}

func (t *Token) TokenName(ctx contractapi.TransactionContextInterface) (string, error) {
	nameBytes, err := ctx.GetStub().GetState(nameKey)
	if err != nil {
		return "", err
	}
	return string(nameBytes), nil
}

func (t *Token) TokenSymbol(ctx contractapi.TransactionContextInterface) (string, error) {
	symbolBytes, err := ctx.GetStub().GetState(symbolKey)
	if err != nil {
		return "", err
	}
	return string(symbolBytes), nil
}

func (t *Token) TokenDecimals(ctx contractapi.TransactionContextInterface) (string, error) {
	decimalsBytes, err := ctx.GetStub().GetState(decimalsKey)
	if err != nil {
		return "", err
	}
	return string(decimalsBytes), nil
}

func (t *Token) TotalSupply(ctx contractapi.TransactionContextInterface) (string, error) {
	totalSupplyBytes, err := ctx.GetStub().GetState(totalSupplyKey)
	if err != nil {
		return "", err
	}
	return string(totalSupplyBytes), nil
}

func (t *Token) BalanceOf(ctx contractapi.TransactionContextInterface, account string) (string, error) {
	balanceKey := balancePrefix + account
	balanceBytes, err := ctx.GetStub().GetState(balanceKey)
	if err != nil {
		return "", err
	}
	if balanceBytes == nil {
		return "", fmt.Errorf("the account %s does not exist", account)
	}
	return string(balanceBytes), nil
}

func (t *Token) Allowance(ctx contractapi.TransactionContextInterface, owner string, spender string) (string, error) {
	allowanceKey := allowancePrefix + owner + spender
	allowanceBytes, err := ctx.GetStub().GetState(allowanceKey)
	if err != nil {
		return "", err
	}
	if allowanceBytes == nil {
		return "", fmt.Errorf("the allowance for %s from %s does not exist", spender, owner)
	}
	return string(allowanceBytes), nil
}

func (t *Token) Transfer(ctx contractapi.TransactionContextInterface, from string, to string, amount string) error {
	amountInt, err := strconv.Atoi(amount)
	if err != nil {
		return err
	}
	if amountInt <= 0 {
		return fmt.Errorf("amount must be greater than 0")
	}
	fromBalance, err := t.BalanceOf(ctx, from)
	if err != nil {
		return err
	}
	fromBalanceInt, err := strconv.Atoi(fromBalance)
	if err != nil {
		return err
	}
	if fromBalanceInt < amountInt {
		return fmt.Errorf("the account %s does not have enough balance", from)
	}
	toBalance, err := t.BalanceOf(ctx, to)
	if err != nil {
		return err
	}
	toBalanceInt, err := strconv.Atoi(toBalance)
	if err != nil {
		return err
	}
	fromBalanceInt = fromBalanceInt - amountInt
	toBalanceInt = toBalanceInt + amountInt
	fromBalance = strconv.Itoa(fromBalanceInt)
	toBalance = strconv.Itoa(toBalanceInt)
	fromBalanceKey := balancePrefix + from
	toBalanceKey := balancePrefix + to
	err = ctx.GetStub().PutState(fromBalanceKey, []byte(fromBalance))
	if err != nil {
		return err
	}
	err = ctx.GetStub().PutState(toBalanceKey, []byte(toBalance))
	if err != nil {
		return err
	}
	return nil
}

func (t *Token) TransferFrom(ctx contractapi.TransactionContextInterface, from string, to string, value string) error {
	amountInt, err := strconv.Atoi(value)
	if err != nil {
		return err
	}
	if amountInt <= 0 {
		return fmt.Errorf("amount must be greater than 0")
	}
	fromBalance, err := t.BalanceOf(ctx, from)
	if err != nil {
		return err
	}
	fromBalanceInt, err := strconv.Atoi(fromBalance)
	if err != nil {
		return err
	}
	if fromBalanceInt < amountInt {
		return fmt.Errorf("the account %s does not have enough balance", from)
	}
	allowance, err := t.Allowance(ctx, from, to)
	if err != nil {
		return err
	}
	allowanceInt, err := strconv.Atoi(allowance)
	if err != nil {
		return err
	}
	if allowanceInt < amountInt {
		return fmt.Errorf("the allowance for %s from %s is not enough", to, from)
	}
	toBalance, err := t.BalanceOf(ctx, to)
	if err != nil {
		return err
	}
	toBalanceInt, err := strconv.Atoi(toBalance)
	if err != nil {
		return err
	}
	fromBalanceInt = fromBalanceInt - amountInt
	toBalanceInt = toBalanceInt + amountInt
	allowanceInt = allowanceInt - amountInt
	fromBalance = strconv.Itoa(fromBalanceInt)
	toBalance = strconv.Itoa(toBalanceInt)
	allowance = strconv.Itoa(allowanceInt)
	fromBalanceKey := balancePrefix + from
	toBalanceKey := balancePrefix + to
	allowanceKey := allowancePrefix + from + to
	err = ctx.GetStub().PutState(fromBalanceKey, []byte(fromBalance))
	if err != nil {
		return err
	}
	err = ctx.GetStub().PutState(toBalanceKey, []byte(toBalance))
	if err != nil {
		return err
	}
	err = ctx.GetStub().PutState(allowanceKey, []byte(allowance))
	if err != nil {
		return err
	}
	return nil
}

func (t *Token) Mint(ctx contractapi.TransactionContextInterface, to string, amount string) error {
	// Check if the contract is initialized
	isInitialized, err := t.CheckInitialized(ctx)
	if err != nil || !isInitialized {
		return fmt.Errorf("contract is not initialized")
	}

	// Get the minter's ID (assuming it's the client's ID in this context)
	minter, err := ctx.GetClientIdentity().GetID()

	// Get the total supply from the ledger
	totalSupplyBytes, err := ctx.GetStub().GetState(totalSupplyKey)
	if err != nil {
		return err
	}

	// Check if total supply exists
	var tSupply int
	if totalSupplyBytes == nil {
		tSupply = 0
	} else {
		tSupply, err = strconv.Atoi(string(totalSupplyBytes))
		if err != nil {
			return err
		}
	}

	// Get the balance of the recipient
	toBalanceKey := balancePrefix + to
	toBalanceBytes, err := ctx.GetStub().GetState(toBalanceKey)
	if err != nil {
		return err
	}

	// Check if balance exists for the recipient
	var balance int
	if toBalanceBytes == nil {
		balance = 0
	} else {
		balance, err = strconv.Atoi(string(toBalanceBytes))
		if err != nil {
			return err
		}
	}

	// Calculate the new balances
	amountInt, err := strconv.Atoi(amount)
	if err != nil {
		return err
	}
	newTotalSupply := tSupply + amountInt
	newToBalance := balance + amountInt

	// Write the updated states back to the ledger
	err = ctx.GetStub().PutState(totalSupplyKey, []byte(strconv.Itoa(newTotalSupply)))
	if err != nil {
		return err
	}
	err = ctx.GetStub().PutState(toBalanceKey, []byte(strconv.Itoa(newToBalance)))
	if err != nil {
		return err
	}

	// Emit the Mint event
	mintEvent := map[string]string{
		"to":     to,
		"amount": amount,
		"minter": minter,
	}
	mintEventJSON, err := json.Marshal(mintEvent)
	if err != nil {
		return err
	}
	ctx.GetStub().SetEvent("Mint", mintEventJSON)

	return nil
}

func (t *Token) Burn(ctx contractapi.TransactionContextInterface, from string, amount string) error {
	// Check if the contract is initialized
	isInitialized, err := t.CheckInitialized(ctx)
	if err != nil || !isInitialized {
		return fmt.Errorf("contract is not initialized")
	}

	// Get the total supply from the ledger
	totalSupplyBytes, err := ctx.GetStub().GetState(totalSupplyKey)
	if err != nil {
		return err
	}

	totalSupply, err := strconv.Atoi(string(totalSupplyBytes))
	if err != nil {
		return err
	}

	// Get the balance of the account to burn from
	fromBalanceKey := balancePrefix + from
	fromBalanceBytes, err := ctx.GetStub().GetState(fromBalanceKey)
	if err != nil {
		return err
	}

	fromBalance, err := strconv.Atoi(string(fromBalanceBytes))
	if err != nil {
		return err
	}

	// Calculate the new balances after burning
	amountInt, err := strconv.Atoi(amount)
	if err != nil {
		return err
	}
	newTotalSupply := totalSupply - amountInt
	newFromBalance := fromBalance - amountInt

	// Update the ledger with the new balances
	err = ctx.GetStub().PutState(totalSupplyKey, []byte(strconv.Itoa(newTotalSupply)))
	if err != nil {
		return err
	}
	err = ctx.GetStub().PutState(fromBalanceKey, []byte(strconv.Itoa(newFromBalance)))
	if err != nil {
		return err
	}

	// Emit the Burn event
	burnEvent := map[string]string{
		"from":   from,
		"amount": amount,
	}
	burnEventJSON, err := json.Marshal(burnEvent)
	if err != nil {
		return err
	}
	ctx.GetStub().SetEvent("Burn", burnEventJSON)

	return nil
}

func (t *Token) CheckInitialized(ctx contractapi.TransactionContextInterface) (bool, error) {
	nameBytes, err := ctx.GetStub().GetState(nameKey)
	if err != nil {
		return false, err
	}
	if nameBytes == nil {
		return false, fmt.Errorf("contract options need to be set before calling any function, call Initialize() to initialize contract")
	}
	return true, nil
}

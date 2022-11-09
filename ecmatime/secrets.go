package ecmatime

import (
	"fmt"
	"io/ioutil"
	"log"

	"gopkg.in/yaml.v2"
	"rogchap.com/v8go"
)

type Secrets interface {
	GetSecret() v8go.FunctionCallback
	SetSecret() v8go.FunctionCallback
}

type secrets struct {
}

func NewSecrets() Secrets {
	return &secrets{}
}

func newStringValue(ctx *v8go.Context, str string) *v8go.Value {
	iso := ctx.Isolate()
	val, _ := v8go.NewValue(iso, str)
	return val
}

type secretsDisk struct {
	Secrets map[string]string `yaml:"secrets"`
}

func readSecrets() *secretsDisk {
	var res secretsDisk
	yamlFile, err := ioutil.ReadFile("secrets.yaml")
	if err != nil {
		log.Printf("yamlFile.Get err   #%v ", err)
	}
	err = yaml.Unmarshal(yamlFile, &res)
	if err != nil {
		log.Fatalf("Unmarshal: %v", err)
	}

	if res.Secrets == nil {
		res.Secrets = make(map[string]string)
	}

	return &res
}

func writeSecrets(val *secretsDisk) error {
	out, err := yaml.Marshal(val)
	if err != nil {
		return err
	}

	err = ioutil.WriteFile("secrets.yaml", out, 0600)
	if err != nil {
		return err
	}
	return nil
}

func (b *secrets) GetSecret() v8go.FunctionCallback {
	return func(info *v8go.FunctionCallbackInfo) *v8go.Value {
		args := info.Args()
		ctx := info.Context()

		if len(args) < 1 {
			return newStringValue(ctx, "")
		}

		secret_name := args[0].String()
		all_secrets := readSecrets()

		if val, ok := all_secrets.Secrets[secret_name]; ok {
			return newStringValue(ctx, val)
		} else {
			return newStringValue(ctx, "")
		}
	}
}

func (b *secrets) SetSecret() v8go.FunctionCallback {
	return func(info *v8go.FunctionCallbackInfo) *v8go.Value {
		args := info.Args()
		ctx := info.Context()

		if len(args) < 2 {
			return newStringValue(ctx, "")
		}

		secret_name := args[0].String()
		secret_value := args[1].String()

		all_secrets := readSecrets()
		all_secrets.Secrets[secret_name] = secret_value
		err := writeSecrets(all_secrets)
		if err != nil {
			return newStringValue(ctx, "")
		}

		return newStringValue(ctx, "OK")
	}
}

func secretsInjectTo(iso *v8go.Isolate, global *v8go.ObjectTemplate) error {
	s := NewSecrets()

	for _, f := range []struct {
		Name string
		Func func() v8go.FunctionCallback
	}{
		{Name: "getSecret", Func: s.GetSecret},
		{Name: "setSecret", Func: s.SetSecret},
	} {
		fn := v8go.NewFunctionTemplate(iso, f.Func())

		if err := global.Set(f.Name, fn, v8go.ReadOnly); err != nil {
			return fmt.Errorf("v8go-polyfills/secrets: %w", err)
		}
	}

	return nil
}

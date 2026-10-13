// Run from the repository root: go run ./docs/examples/adk-config-options
package main

import (
	"context"
	"errors"
	"fmt"
	"log"

	"github.com/cloudwego/eino/adk"
	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/compose"
	"github.com/cloudwego/eino/schema"
)

// This fake model makes the option path visible without requiring an API key.
type demoModel struct{}

func (*demoModel) Generate(_ context.Context, messages []*schema.Message, opts ...model.Option) (*schema.Message, error) {
	mo := model.GetCommonOptions(nil, opts...)
	if mo.Temperature == nil {
		return nil, errors.New("model did not receive temperature option")
	}
	fmt.Printf("MODEL: system=%q temperature=%.1f tools=%d\n", messages[0].Content, *mo.Temperature, len(mo.Tools))
	last := messages[len(messages)-1]
	if last.Role == schema.Tool {
		return schema.AssistantMessage("最终回答："+last.Content, nil), nil
	}
	return schema.AssistantMessage("", []schema.ToolCall{{
		ID:   "call-1",
		Type: "function",
		Function: schema.FunctionCall{
			Name:      "lookup_order",
			Arguments: `{"id":"A100"}`,
		},
	}}), nil
}

func (*demoModel) Stream(context.Context, []*schema.Message, ...model.Option) (*schema.StreamReader[*schema.Message], error) {
	return nil, errors.New("this demo uses non-streaming RunnerConfig")
}

type lookupOptions struct{ Prefix string }

func withLookupPrefix(prefix string) tool.Option {
	return tool.WrapImplSpecificOptFn(func(o *lookupOptions) { o.Prefix = prefix })
}

type lookupOrder struct{}

func (*lookupOrder) Info(context.Context) (*schema.ToolInfo, error) {
	return &schema.ToolInfo{
		Name: "lookup_order",
		Desc: "Look up an order by ID",
		ParamsOneOf: schema.NewParamsOneOfByParams(map[string]*schema.ParameterInfo{
			"id": {Type: schema.String, Required: true},
		}),
	}, nil
}

func (*lookupOrder) InvokableRun(ctx context.Context, argumentsInJSON string, opts ...tool.Option) (string, error) {
	user, _ := adk.GetSessionValue(ctx, "User")
	to := tool.GetImplSpecificOptions[lookupOptions](nil, opts...)
	fmt.Printf("TOOL: user=%v prefix=%q args=%s\n", user, to.Prefix, argumentsInJSON)
	return to.Prefix + "订单 A100 已发货", nil
}

func main() {
	ctx := context.Background()
	agent, err := adk.NewChatModelAgent(ctx, &adk.ChatModelAgentConfig{
		Name:        "order_assistant",
		Instruction: "你是 {User} 的订单助手",
		Model:       &demoModel{},
		ToolsConfig: adk.ToolsConfig{
			ToolsNodeConfig: compose.ToolsNodeConfig{Tools: []tool.BaseTool{&lookupOrder{}}},
		},
	})
	if err != nil {
		log.Fatal(err)
	}
	runner := adk.NewRunner(ctx, adk.RunnerConfig{Agent: agent})
	iter := runner.Query(ctx, "查一下 A100",
		adk.WithSessionValues(map[string]any{"User": "小明"}),
		adk.WithChatModelOptions([]model.Option{model.WithTemperature(0.2)}).DesignateAgent("order_assistant"),
		adk.WithToolOptions([]tool.Option{withLookupPrefix("查询结果：")}),
	)
	for {
		event, ok := iter.Next()
		if !ok {
			break
		}
		if event.Err != nil {
			log.Fatal(event.Err)
		}
		if event.Output != nil && event.Output.MessageOutput != nil {
			msg, _, err := adk.GetMessage(event)
			if err != nil {
				log.Fatal(err)
			}
			if msg != nil && msg.Role == schema.Assistant && len(msg.ToolCalls) == 0 {
				fmt.Println("EVENT:", msg.Content)
			}
		}
	}
}

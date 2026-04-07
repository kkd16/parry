package eval

import (
	"github.com/kkd16/parry/internal/policy"
)

type Result struct {
	Entry    Entry
	Expected policy.Action
	Got      policy.Action
	Err      error
	Pass     bool
}

type Summary struct {
	Total   int
	Pass    int
	Fail    int
	Errored int
	Results []Result
}

func Run(engine *policy.Engine, entries []Entry) Summary {
	s := Summary{Total: len(entries)}
	for _, e := range entries {
		expected, _ := e.ExpectedAction()
		tool, _ := e.CanonicalTool()

		got, err := engine.Evaluate(tool, e.ToolInput)
		r := Result{Entry: e, Expected: expected, Got: got, Err: err}

		switch {
		case err != nil:
			s.Errored++
		case got == expected:
			r.Pass = true
			s.Pass++
		default:
			s.Fail++
		}
		s.Results = append(s.Results, r)
	}
	return s
}

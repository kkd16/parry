package eval

import (
	"github.com/kkd16/parry/internal/policy"
)

type Result struct {
	Entry Entry
	Got   policy.Action
	Err   error
	Pass  bool
}

type Summary struct {
	Total      int
	Pass       int
	Fail       int
	Errored    int
	Bypasses   int
	Hostile    int
	Caught     int
	TrueBypass int
	Results    []Result
}

func Run(engine *policy.Engine, entries []Entry) Summary {
	s := Summary{Total: len(entries), Results: make([]Result, 0, len(entries))}
	for _, e := range entries {
		got, err := engine.Evaluate(e.canonical, e.ToolInput)
		r := Result{Entry: e, Got: got, Err: err}

		switch {
		case err != nil:
			s.Errored++
		case got == e.expected:
			r.Pass = true
			s.Pass++
		case e.Bypass:
			s.Bypasses++
			r.Pass = true
		default:
			s.Fail++
		}
		s.Results = append(s.Results, r)

		if e.expected != policy.Allow {
			s.Hostile++
			if got == policy.Allow {
				s.TrueBypass++
			} else {
				s.Caught++
			}
		}
	}
	return s
}

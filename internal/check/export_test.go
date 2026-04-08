package check

func SetAgentsForTest(newAgents []Agent) (restore func()) {
	saved := agents
	agents = newAgents
	return func() { agents = saved }
}

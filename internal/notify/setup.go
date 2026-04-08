package notify

type SetupResult struct {
	Provider     string
	Details      [][2]string
	Instructions []string
	TestSent     bool
	TestErr      error
}

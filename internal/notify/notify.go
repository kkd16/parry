package notify

import "context"

type ConfirmRequest struct {
	Tool    string
	RawName string
	Command string
	Tier    int
}

type Confirmer interface {
	Confirm(ctx context.Context, req ConfirmRequest) (bool, error)
}

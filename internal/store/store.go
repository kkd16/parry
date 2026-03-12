package store

type Store struct{}

func Open(path string) (*Store, error) {
	// TODO: open SQLite, run migrations
	return &Store{}, nil
}

func (s *Store) Close() error {
	return nil
}

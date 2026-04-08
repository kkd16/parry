package dashboard

import (
	"encoding/json"
	"net/http"
	"reflect"
	"strconv"
)

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(normalizeForJSON(v))
}

func normalizeForJSON(v any) any {
	if v == nil {
		return v
	}
	rv := reflect.ValueOf(v)
	if !mayContainNilContainer(rv.Type()) {
		return v
	}
	addr := reflect.New(rv.Type()).Elem()
	addr.Set(rv)
	normalizeValue(addr)
	return addr.Interface()
}

func mayContainNilContainer(t reflect.Type) bool {
	switch t.Kind() {
	case reflect.Slice, reflect.Map, reflect.Interface, reflect.Pointer, reflect.Struct, reflect.Array:
		return true
	default:
		return false
	}
}

func normalizeValue(v reflect.Value) {
	switch v.Kind() {
	case reflect.Pointer:
		if !v.IsNil() {
			normalizeValue(v.Elem())
		}
	case reflect.Interface:
		if v.IsNil() {
			return
		}
		inner := v.Elem()
		if !mayContainNilContainer(inner.Type()) {
			return
		}
		copyV := reflect.New(inner.Type()).Elem()
		copyV.Set(inner)
		normalizeValue(copyV)
		v.Set(copyV)
	case reflect.Struct:
		for _, f := range v.Fields() {
			if f.CanSet() {
				normalizeValue(f)
			}
		}
	case reflect.Slice:
		if v.IsNil() {
			if v.CanSet() {
				v.Set(reflect.MakeSlice(v.Type(), 0, 0))
			}
			return
		}
		if !mayContainNilContainer(v.Type().Elem()) {
			return
		}
		for i := range v.Len() {
			normalizeValue(v.Index(i))
		}
	case reflect.Array:
		if !mayContainNilContainer(v.Type().Elem()) {
			return
		}
		for i := range v.Len() {
			normalizeValue(v.Index(i))
		}
	case reflect.Map:
		if v.IsNil() {
			if v.CanSet() {
				v.Set(reflect.MakeMap(v.Type()))
			}
			return
		}
		elemType := v.Type().Elem()
		if elemType.Kind() != reflect.Interface && !mayContainNilContainer(elemType) {
			return
		}
		iter := v.MapRange()
		for iter.Next() {
			mv := iter.Value()
			copyV := reflect.New(mv.Type()).Elem()
			copyV.Set(mv)
			normalizeValue(copyV)
			v.SetMapIndex(iter.Key(), copyV)
		}
	}
}

func intParam(s string, fallback, min, max int) int {
	if s == "" {
		return fallback
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return fallback
	}
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}

/**
 * @fileoverview WASI Sidecar Main Loop
 *
 * Long-lived process that reads MessagePack requests from stdin,
 * processes tag operations via TagLib, and writes responses to stdout.
 *
 * Protocol (length-prefixed MessagePack):
 * - Request:  [4-byte LE length][msgpack: {op, path, tags?}]
 * - Response: [4-byte LE length][msgpack: {ok, tags?, error?}]
 */

#include "taglib_api.h"
#include "core/taglib_core.h"
#include "core/taglib_msgpack.h"
#include <mpack/mpack.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX_REQUEST_SIZE (64 * 1024 * 1024)

static int read_request(uint8_t** buf, size_t* len) {
    uint32_t msg_len;
    if (fread(&msg_len, sizeof(uint32_t), 1, stdin) != 1) {
        return -1;
    }

    if (msg_len > MAX_REQUEST_SIZE) {
        return -1;
    }

    *buf = malloc(msg_len);
    if (!*buf) {
        return -1;
    }

    if (fread(*buf, 1, msg_len, stdin) != msg_len) {
        free(*buf);
        *buf = NULL;
        return -1;
    }

    *len = msg_len;
    return 0;
}

static void write_response(const uint8_t* buf, size_t len) {
    uint32_t msg_len = (uint32_t)len;
    fwrite(&msg_len, sizeof(uint32_t), 1, stdout);
    fwrite(buf, 1, len, stdout);
    fflush(stdout);
}

static void write_error_response(const char* error_msg) {
    char* data = NULL;
    size_t size = 0;
    mpack_writer_t writer;
    mpack_writer_init_growable(&writer, &data, &size);

    mpack_start_map(&writer, 2);
    mpack_write_cstr(&writer, "ok");
    mpack_write_false(&writer);
    mpack_write_cstr(&writer, "error");
    mpack_write_cstr(&writer, error_msg);
    mpack_finish_map(&writer);

    mpack_error_t error = mpack_writer_destroy(&writer);
    if (error == mpack_ok && data) {
        write_response((uint8_t*)data, size);
    }
    if (data) free(data);
}

static void write_success_response(const uint8_t* tags_data, size_t tags_size) {
    char* data = NULL;
    size_t size = 0;
    mpack_writer_t writer;
    mpack_writer_init_growable(&writer, &data, &size);

    mpack_start_map(&writer, 2);
    mpack_write_cstr(&writer, "ok");
    mpack_write_true(&writer);
    mpack_write_cstr(&writer, "tags");
    mpack_write_bin(&writer, (const char*)tags_data, (uint32_t)tags_size);
    mpack_finish_map(&writer);

    mpack_error_t error = mpack_writer_destroy(&writer);
    if (error == mpack_ok && data) {
        write_response((uint8_t*)data, size);
    }
    if (data) free(data);
}

static void write_write_success_response(void) {
    char* data = NULL;
    size_t size = 0;
    mpack_writer_t writer;
    mpack_writer_init_growable(&writer, &data, &size);

    mpack_start_map(&writer, 1);
    mpack_write_cstr(&writer, "ok");
    mpack_write_true(&writer);
    mpack_finish_map(&writer);

    mpack_error_t error = mpack_writer_destroy(&writer);
    if (error == mpack_ok && data) {
        write_response((uint8_t*)data, size);
    }
    if (data) free(data);
}

typedef struct {
    char* op;
    char* path;
    uint8_t* tags_data;
    size_t tags_size;
} Request;

static int parse_request(const uint8_t* buf, size_t len, Request* req) {
    memset(req, 0, sizeof(Request));

    mpack_reader_t reader;
    mpack_reader_init_data(&reader, (const char*)buf, len);

    uint32_t map_count = mpack_expect_map(&reader);
    if (mpack_reader_error(&reader) != mpack_ok) {
        mpack_reader_destroy(&reader);
        return -1;
    }

    for (uint32_t i = 0; i < map_count; i++) {
        uint32_t key_len = mpack_expect_str(&reader);
        if (mpack_reader_error(&reader) != mpack_ok) {
            mpack_reader_destroy(&reader);
            return -1;
        }

        char key[32] = {0};
        if (key_len >= sizeof(key)) {
            mpack_skip_bytes(&reader, key_len);
            mpack_done_str(&reader);
            mpack_discard(&reader);
            continue;
        }

        mpack_read_bytes(&reader, key, key_len);
        mpack_done_str(&reader);
        key[key_len] = '\0';

        if (strcmp(key, "op") == 0) {
            uint32_t val_len = mpack_expect_str(&reader);
            if (mpack_reader_error(&reader) != mpack_ok) {
                mpack_reader_destroy(&reader);
                return -1;
            }
            req->op = malloc(val_len + 1);
            if (!req->op) {
                mpack_reader_destroy(&reader);
                return -1;
            }
            mpack_read_bytes(&reader, req->op, val_len);
            mpack_done_str(&reader);
            req->op[val_len] = '\0';
        } else if (strcmp(key, "path") == 0) {
            uint32_t val_len = mpack_expect_str(&reader);
            if (mpack_reader_error(&reader) != mpack_ok) {
                mpack_reader_destroy(&reader);
                return -1;
            }
            req->path = malloc(val_len + 1);
            if (!req->path) {
                mpack_reader_destroy(&reader);
                return -1;
            }
            mpack_read_bytes(&reader, req->path, val_len);
            mpack_done_str(&reader);
            req->path[val_len] = '\0';
        } else if (strcmp(key, "tags") == 0) {
            uint32_t bin_len = mpack_expect_bin(&reader);
            if (mpack_reader_error(&reader) != mpack_ok) {
                mpack_reader_destroy(&reader);
                return -1;
            }
            req->tags_data = malloc(bin_len);
            if (!req->tags_data) {
                mpack_reader_destroy(&reader);
                return -1;
            }
            mpack_read_bytes(&reader, (char*)req->tags_data, bin_len);
            mpack_done_bin(&reader);
            req->tags_size = bin_len;
        } else {
            mpack_discard(&reader);
        }
    }

    mpack_done_map(&reader);
    mpack_error_t error = mpack_reader_error(&reader);
    mpack_reader_destroy(&reader);

    return (error == mpack_ok) ? 0 : -1;
}

static void free_request(Request* req) {
    if (req->op) free(req->op);
    if (req->path) free(req->path);
    if (req->tags_data) free(req->tags_data);
    memset(req, 0, sizeof(Request));
}

static void handle_read_tags(const Request* req) {
    if (!req->path) {
        write_error_response("Missing path for read_tags operation");
        return;
    }

    size_t out_size = 0;
    uint8_t* result = tl_read_tags(req->path, NULL, 0, &out_size);

    if (!result) {
        const char* error = tl_get_last_error();
        write_error_response(error ? error : "Failed to read tags");
        return;
    }

    write_success_response(result, out_size);
    tl_free(result);
}

static void handle_write_tags(const Request* req) {
    if (!req->path) {
        write_error_response("Missing path for write_tags operation");
        return;
    }

    if (!req->tags_data || req->tags_size == 0) {
        write_error_response("Missing tags data for write_tags operation");
        return;
    }

    int status = tl_write_tags(req->path, NULL, 0,
                               req->tags_data, req->tags_size,
                               NULL, NULL);

    if (status != TL_SUCCESS) {
        const char* error = tl_get_last_error();
        write_error_response(error ? error : "Failed to write tags");
        return;
    }

    write_write_success_response();
}

int main(void) {
    uint8_t* req_buf = NULL;
    size_t req_len = 0;

    while (read_request(&req_buf, &req_len) == 0) {
        Request req;
        if (parse_request(req_buf, req_len, &req) != 0) {
            write_error_response("Failed to parse request");
            free(req_buf);
            req_buf = NULL;
            continue;
        }

        if (!req.op) {
            write_error_response("Missing 'op' field in request");
            free_request(&req);
            free(req_buf);
            req_buf = NULL;
            continue;
        }

        if (strcmp(req.op, "read_tags") == 0) {
            handle_read_tags(&req);
        } else if (strcmp(req.op, "write_tags") == 0) {
            handle_write_tags(&req);
        } else {
            write_error_response("Unknown operation: expected 'read_tags' or 'write_tags'");
        }

        free_request(&req);
        free(req_buf);
        req_buf = NULL;
    }

    return 0;
}
